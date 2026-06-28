import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { accountingService } from "@modules/accounting/api/accountingService";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";
import type { AccountDto } from "@erp/shared-types";

export type LoadedBalanceSheetData = {
  accounts: AccountDto[];
  netProfit: number;
  totalDrawings: number;
};

const emptyData: LoadedBalanceSheetData = {
  accounts: [],
  netProfit: 0,
  totalDrawings: 0,
};

export function useBalanceSheetReport() {
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
      const [accounts, entries, salesInvoices, purchaseInvoices] = await Promise.all([
        accountingService.getChartOfAccounts(),
        journalEntryService.listJournalEntries({}),
        invoiceService.listInvoicesByType("Sales"),
        invoiceService.listInvoicesByType("Purchase"),
      ]);

      const DRAWINGS_ID = "00000000-0000-0000-0000-000000000044";

      let totalRevenue = 0;
      let totalExpenses = 0;
      let totalDrawings = 0;

      const revenueAccounts = new Set(
        accounts.filter(a => a.account_type === "Revenue").map(a => a.id),
      );
      const expenseAccounts = new Set(
        accounts.filter(a => a.account_type === "Expenses").map(a => a.id),
      );

      for (const entry of entries) {
        for (const line of entry.lines) {
          const amt = parseFloat(line.debit_base || line.debit || "0") - parseFloat(line.credit_base || line.credit || "0");
          if (line.account_id === DRAWINGS_ID) {
            totalDrawings += Math.abs(amt);
          } else if (revenueAccounts.has(line.account_id)) {
            totalRevenue += amt;
          } else if (expenseAccounts.has(line.account_id)) {
            totalExpenses += Math.abs(amt);
          }
        }
      }

      const salesTotal = (salesInvoices ?? [])
        .filter(inv => inv.status === "Posted")
        .reduce((s, inv) => s + parseFloat(inv.total_amount || "0"), 0);
      const purchaseTotal = (purchaseInvoices ?? [])
        .filter(inv => inv.status === "Posted")
        .reduce((s, inv) => s + parseFloat(inv.total_amount || "0"), 0);

      const netProfit = totalRevenue + salesTotal - totalExpenses - purchaseTotal;

      setReportData({ accounts, netProfit, totalDrawings });
      hasLoadedOnceRef.current = true;
      setLastLoadedAt(new Date());
    } catch (error) {
      console.error(error);
      toast.error("تعذر تحميل بيانات الميزانية العمومية");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReportData();
  }, [loadReportData]);

  return { loading, refreshing, lastLoadedAt, reportData, loadReportData };
}
