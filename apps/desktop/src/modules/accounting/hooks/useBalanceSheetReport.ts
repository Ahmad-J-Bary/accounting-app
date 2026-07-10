import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { accountingService } from "@modules/accounting/api/accountingService";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";
import { materialService } from "@modules/inventory/api/materialService";
import {
  computeIncomeStatement,
  emptyIncomeStatementData,
  type IncomeStatementFilters,
  type LoadedIncomeStatementData,
} from "@modules/accounting/lib/incomeStatement";
import { SYSTEM_ACCOUNT_IDS } from "@erp/shared-types";
import type { AccountDto, AccountLedgerDto, MaterialDto, StockMovementDetailDto } from "@erp/shared-types";

export type LoadedBalanceSheetData = {
  accounts: AccountDto[];
  netProfit: number;
  totalDrawings: number;
  ledgerTotals: Map<string, { debit: number; credit: number }>;
  closingInventory: number;
};

const emptyData: LoadedBalanceSheetData = {
  accounts: [],
  netProfit: 0,
  totalDrawings: 0,
  ledgerTotals: new Map(),
  closingInventory: 0,
};

export function useBalanceSheetReport(filters: IncomeStatementFilters) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [reportData, setReportData] = useState<LoadedBalanceSheetData>(emptyData);
  const hasLoadedOnceRef = useRef(false);

  const loadReportData = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnceRef.current;
    if (isFirstLoad) setLoading(true);
    else setRefreshing(true);

    try {
      const [
        accounts,
        entries,
        salesInvoices,
        purchaseInvoices,
        purchaseReturns,
        salesReturns,
        expenseAccounts,
        materials,
      ] = await Promise.all([
        accountingService.getChartOfAccounts(),
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
      ]);

      const movementResults = await Promise.allSettled(
        materials.map(async (material: MaterialDto) => ({
          materialId: material.id,
          movements: await materialService.listMovementsByMaterial(material.id),
        })),
      );

      const ledgerResults = await Promise.allSettled(
        expenseAccounts.map(async (account) => ({
          accountId: account.id,
          ledger: await accountingService.getAccountLedger(account.id),
        })),
      );

      const stockMovementsByMaterial = new Map<string, StockMovementDetailDto[]>();
      movementResults.forEach((result) => {
        if (result.status === "fulfilled") {
          stockMovementsByMaterial.set(result.value.materialId, result.value.movements ?? []);
        }
      });

      const expenseLedgers = new Map<string, AccountLedgerDto>();
      ledgerResults.forEach((result) => {
        if (result.status === "fulfilled") {
          expenseLedgers.set(result.value.accountId, result.value.ledger);
        }
      });

      const incomeStatementData: LoadedIncomeStatementData = {
        ...emptyIncomeStatementData,
        salesInvoices,
        purchaseInvoices,
        purchaseReturns,
        salesReturns,
        expenseAccounts,
        expenseLedgers,
        stockMovementsByMaterial,
        materials,
      };

      const incomeStatementResult = computeIncomeStatement(filters, incomeStatementData);

      let totalDrawings = 0;

      const ledgerTotals = new Map<string, { debit: number; credit: number }>();

      for (const account of accounts) {
        const openingBalance = parseFloat(account.opening_balance || "0");
        if (openingBalance !== 0) {
          const existing = ledgerTotals.get(account.id) || { debit: 0, credit: 0 };
          if (["Liabilities", "Equity", "Revenue"].includes(account.account_type)) {
            existing.credit += Math.abs(openingBalance);
          } else {
            existing.debit += Math.abs(openingBalance);
          }
          ledgerTotals.set(account.id, existing);
        }
      }

      for (const entry of entries) {
        for (const line of entry.lines) {
          const amt = parseFloat(line.debit_base || line.debit || "0") - parseFloat(line.credit_base || line.credit || "0");
          if (line.account_id === SYSTEM_ACCOUNT_IDS.DRAWINGS) {
            totalDrawings += Math.abs(amt);
          }

          const cur = ledgerTotals.get(line.account_id) || { debit: 0, credit: 0 };
          cur.debit += parseFloat(line.debit_base || line.debit || "0");
          cur.credit += parseFloat(line.credit_base || line.credit || "0");
          ledgerTotals.set(line.account_id, cur);
        }
      }

      let netPurchaseCost = 0;
      for (const inv of purchaseInvoices) {
        if (inv.status !== "Posted" && inv.status !== "Paid") continue;
        netPurchaseCost += parseFloat(inv.extra_costs || "0");
      }

      for (const account of accounts) {
        if (account.name_ar === "تكاليف إضافية على المشتريات") {
          const debit = Math.abs(netPurchaseCost);
          const credit = Math.abs(netPurchaseCost);
          ledgerTotals.set(account.id, { debit, credit });
        }
      }

      setReportData({
        accounts,
        netProfit: incomeStatementResult.netProfit,
        totalDrawings,
        ledgerTotals,
        closingInventory: incomeStatementResult.closingInventory,
      });
      hasLoadedOnceRef.current = true;
      setLastLoadedAt(new Date());
    } catch (error) {
      console.error(error);
      toast.error("تعذر تحميل بيانات الميزانية العمومية");
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
