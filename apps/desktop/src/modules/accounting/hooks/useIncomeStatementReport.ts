import { useCallback } from "react";
import { accountingService } from "@modules/accounting/api/accountingService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";
import { materialService } from "@modules/inventory/api/materialService";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { useReportData } from "@shared/hooks/useReportData";
import { useMaterialExpenseLedgers } from "@shared/hooks/useMaterialExpenseLedgers";
import { emptyIncomeStatementData } from "@modules/accounting/lib/incomeStatement";
import type { LoadedIncomeStatementData } from "@modules/accounting/lib/incomeStatement";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { ReportState } from "@shared/types/report";

export function useIncomeStatementReport(): ReportState<LoadedIncomeStatementData> {
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

  return useReportData({
    queryKey: QUERY_KEYS.incomeStatement,
    fetchData: fetchReportData,
    emptyData: emptyIncomeStatementData,
    errorMessage: "تعذر تحميل بيانات قائمة الدخل",
  });
}