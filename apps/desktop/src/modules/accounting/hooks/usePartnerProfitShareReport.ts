import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { accountingService } from "@modules/accounting/api/accountingService";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";
import { materialService } from "@modules/inventory/api/materialService";
import { partnerService } from "@modules/partners/api/partnerService";
import { fixedAssetService } from "@modules/fixed-assets/api/fixedAssetService";
import { computeIncomeStatement, emptyIncomeStatementData } from "@modules/accounting/lib/incomeStatement";
import type { LoadedIncomeStatementData, IncomeStatementFilters } from "@modules/accounting/lib/incomeStatement";
import type { PartnerDto, MaterialDto, StockMovementDetailDto, AccountLedgerDto } from "@erp/shared-types";

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

export function usePartnerProfitShareReport(filters: IncomeStatementFilters) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [reportData, setReportData] = useState<LoadedPartnerProfitShareData>(emptyData);
  const hasLoadedOnceRef = useRef(false);

  const loadReportData = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnceRef.current;
    if (isFirstLoad) setLoading(true);
    else setRefreshing(true);

    try {
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

      const movementResults = await Promise.allSettled(
        materials.map(async (material: MaterialDto) => ({
          materialId: material.id,
          movements: await materialService.listMovementsByMaterial(material.id),
        })),
      );

      const stockMovementsByMaterial = new Map<string, StockMovementDetailDto[]>();
      movementResults.forEach((result) => {
        if (result.status === "fulfilled") {
          stockMovementsByMaterial.set(result.value.materialId, result.value.movements ?? []);
        }
      });

      const ledgerResults = await Promise.allSettled(
        expenseItems.map(async (account) => ({
          accountId: account.id,
          ledger: await accountingService.getAccountLedger(account.id),
        })),
      );

      const expenseLedgers = new Map<string, AccountLedgerDto>();
      ledgerResults.forEach((result) => {
        if (result.status === "fulfilled") {
          expenseLedgers.set(result.value.accountId, result.value.ledger);
        }
      });

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
        })
      );

      setReportData({
        partners,
        netProfit: incomeStatementResult.netProfit,
        inventoryValue: incomeStatementResult.closingInventory,
        fixedAssetsValue,
        partnerDrawings,
        customerDebts,
        partnerLedgers,
      });
      hasLoadedOnceRef.current = true;
      setLastLoadedAt(new Date());
    } catch (error) {
      console.error(error);
      toast.error("تعذر تحميل بيانات الشركاء وتقاسم الأرباح");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadReportData();
  }, [loadReportData]);

  return { loading, refreshing, lastLoadedAt, reportData, loadReportData };
}
