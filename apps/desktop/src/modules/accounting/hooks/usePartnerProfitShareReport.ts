import { useCallback } from "react";
import { accountingService } from "@modules/accounting/api/accountingService";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";
import { materialService } from "@modules/inventory/api/materialService";
import { partnerService } from "@modules/partners/api/partnerService";
import { fixedAssetService } from "@modules/fixed-assets/api/fixedAssetService";
import { computeIncomeStatement } from "@modules/accounting/lib/incomeStatement";
import type { LoadedIncomeStatementData, IncomeStatementFilters } from "@modules/accounting/lib/incomeStatement";
import type { PartnerDto, AccountLedgerDto } from "@erp/shared-types";
import { useMaterialExpenseLedgers } from "@shared/hooks/useMaterialExpenseLedgers";
import { useReportData } from "@shared/hooks/useReportData";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { ReportState } from "@shared/types/report";

export type LoadedPartnerProfitShareData = {
  partners: PartnerDto[];
  netProfit: number;
  inventoryValue: number;
  fixedAssetsValue: number;
  partnerDrawings: Record<string, number>;
  customerDebts: number;
  partnerLedgers: Record<string, AccountLedgerDto>;
};

const emptyData: LoadedPartnerProfitShareData = {
  partners: [],
  netProfit: 0,
  inventoryValue: 0,
  fixedAssetsValue: 0,
  partnerDrawings: {},
  customerDebts: 0,
  partnerLedgers: {},
};

export function usePartnerProfitShareReport(filters: IncomeStatementFilters): ReportState<LoadedPartnerProfitShareData> {
  const { loadMaterialExpenseLedgers } = useMaterialExpenseLedgers();

  const fetchReportData = useCallback(async (): Promise<LoadedPartnerProfitShareData> => {
    const [partners, entries, salesInvoices, purchaseInvoices, purchaseReturns, salesReturns, expenseItems, materials, receivables, fixedAssets] = await Promise.all([
      partnerService.listPartners(),
      journalEntryService.listJournalEntries({
        from_date: filters.from_date,
        to_date: filters.to_date,
      }),
      invoiceService.listInvoicesByType("Sales"),
      invoiceService.listInvoicesByType("Purchase"),
      returnService.listPurchaseReturns(),
      returnService.listSalesReturns(),
      accountingService.getExpenseItems(),
      materialService.listMaterials(),
      accountingService.getReceivablesPayablesSummary(),
      fixedAssetService.list(),
    ]);

    const { stockMovementsByMaterial, expenseLedgers } = await loadMaterialExpenseLedgers(materials, expenseItems);

    const incomeStatementData: LoadedIncomeStatementData = {
      salesInvoices,
      purchaseInvoices,
      purchaseReturns,
      salesReturns,
      expenseAccounts: expenseItems,
      expenseLedgers,
      stockMovementsByMaterial,
      materials,
    };

    const incomeStatementResult = computeIncomeStatement(filters, incomeStatementData);

    const partnerDrawings: Record<string, number> = {};
    const drawingsAccountMap: Record<string, string> = {};
    for (const p of partners) {
      if (p.drawings_account_id) {
        drawingsAccountMap[p.drawings_account_id] = p.id;
        partnerDrawings[p.id] = 0;
      }
    }

    for (const entry of entries) {
      for (const line of entry.lines) {
        const amt = parseFloat(line.debit_base || line.debit || "0") - parseFloat(line.credit_base || line.credit || "0");
        const pId = drawingsAccountMap[line.account_id];
        if (pId) {
          partnerDrawings[pId] = (partnerDrawings[pId] || 0) + Math.abs(amt);
        }
      }
    }

    const customerDebts = parseFloat(receivables?.customers_debit || "0");
    const fixedAssetsValue = (fixedAssets ?? [])
      .filter((asset) => asset.status === "Active")
      .reduce((sum, asset) => {
        const purchaseCost = parseFloat(asset.purchase_cost.amount || "0");
        const accumulated = parseFloat(asset.accumulated_depreciation.amount || "0");
        return sum + (purchaseCost - accumulated);
      }, 0);

    const partnerLedgers: Record<string, AccountLedgerDto> = {};
    await Promise.allSettled(
      partners.map(async (p) => {
        const accountIds = [p.linked_account_id, p.drawings_account_id].filter(Boolean) as string[];
        const ledgers = await Promise.allSettled(
          accountIds.map((id) => accountingService.getAccountLedger(id))
        );
        ledgers.forEach((result, i) => {
          if (result.status === "fulfilled") {
            partnerLedgers[accountIds[i]] = result.value;
          }
        });
      }),
    );

    return {
      partners,
      netProfit: incomeStatementResult.netProfit,
      inventoryValue: incomeStatementResult.closingInventory,
      fixedAssetsValue,
      partnerDrawings,
      customerDebts,
      partnerLedgers,
    };
  }, [filters, loadMaterialExpenseLedgers]);

  return useReportData({
    queryKey: [QUERY_KEYS.partnerProfitShare[0], QUERY_KEYS.partnerProfitShare[1], filters.from_date, filters.to_date] as const,
    fetchData: fetchReportData,
    emptyData: emptyData,
    errorMessage: "تعذر تحميل بيانات الشركاء وتقاسم الأرباح",
  });
}