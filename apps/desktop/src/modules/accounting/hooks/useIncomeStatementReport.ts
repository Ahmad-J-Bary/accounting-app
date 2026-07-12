import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { accountingService } from "@modules/accounting/api/accountingService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";
import { materialService } from "@modules/inventory/api/materialService";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import {
  emptyIncomeStatementData,
  type LoadedIncomeStatementData,
} from "@modules/accounting/lib/incomeStatement";
import { useMaterialExpenseLedgers } from "@shared/hooks/useMaterialExpenseLedgers";
import { QUERY_KEYS } from "@shared/hooks/queryClient";

export function useIncomeStatementReport() {
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const { loadMaterialExpenseLedgers } = useMaterialExpenseLedgers();

  const fetchReportData = useCallback(async (): Promise<LoadedIncomeStatementData> => {
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
      journalEntryService.listJournalEntries({}),
      invoiceService.listInvoicesByType("Sales"),
      invoiceService.listInvoicesByType("Purchase"),
      returnService.listPurchaseReturns(),
      returnService.listSalesReturns(),
      accountingService.getExpenseItems(),
      materialService.listMaterials(),
    ]);

    const { stockMovementsByMaterial, expenseLedgers } = await loadMaterialExpenseLedgers(materials, expenseAccounts);

    return {
      salesInvoices: salesInvoices ?? [],
      purchaseInvoices: purchaseInvoices ?? [],
      purchaseReturns: purchaseReturns ?? [],
      salesReturns: salesReturns ?? [],
      expenseAccounts: expenseAccounts ?? [],
      expenseLedgers,
      stockMovementsByMaterial,
      materials,
      accounts: accounts ?? [],
      entries: entries ?? [],
    };
  }, [loadMaterialExpenseLedgers]);

  const { data: reportData, isLoading, isFetching, refetch } = useQuery({
    queryKey: QUERY_KEYS.incomeStatement,
    queryFn: fetchReportData,
    initialData: emptyIncomeStatementData,
  });

  const loadReportData = useCallback(async () => {
    try {
      await refetch();
      hasLoadedOnceRef.current = true;
      setLastLoadedAt(new Date());
    } catch (error) {
      console.error(error);
      toast.error("تعذر تحميل بيانات قائمة الدخل");
    }
  }, [refetch]);

  const refreshing = isFetching && hasLoadedOnceRef.current;
  const loading = isLoading && !hasLoadedOnceRef.current;

  return {
    loading,
    refreshing,
    lastLoadedAt,
    reportData: reportData ?? emptyIncomeStatementData,
    loadReportData,
  };
}
