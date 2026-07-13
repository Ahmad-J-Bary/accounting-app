import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { accountingService } from "@modules/accounting/api/accountingService";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";
import { materialService } from "@modules/inventory/api/materialService";
import type { ReportFilters } from "@shared/types/filters";

export function useReportBaseData(filters?: ReportFilters) {
  const accountsQuery = useQuery({
    queryKey: QUERY_KEYS.chartOfAccounts,
    queryFn: () => accountingService.getChartOfAccounts(),
  });

  const journalEntriesQuery = useQuery({
    queryKey: QUERY_KEYS.journalEntries(filters ? { from_date: filters.from_date, to_date: filters.to_date } : {}),
    queryFn: () => journalEntryService.listJournalEntries(filters ? { from_date: filters.from_date, to_date: filters.to_date } : {}),
  });

  const salesInvoicesQuery = useQuery({
    queryKey: QUERY_KEYS.salesInvoices,
    queryFn: () => invoiceService.listInvoicesByType("Sales"),
  });

  const purchaseInvoicesQuery = useQuery({
    queryKey: QUERY_KEYS.purchaseInvoices,
    queryFn: () => invoiceService.listInvoicesByType("Purchase"),
  });

  const salesReturnsQuery = useQuery({
    queryKey: QUERY_KEYS.salesReturns,
    queryFn: () => returnService.listSalesReturns(),
  });

  const purchaseReturnsQuery = useQuery({
    queryKey: QUERY_KEYS.purchaseReturns,
    queryFn: () => returnService.listPurchaseReturns(),
  });

  const expenseAccountsQuery = useQuery({
    queryKey: QUERY_KEYS.expenseItems,
    queryFn: () => accountingService.getExpenseItems(),
  });

  const materialsQuery = useQuery({
    queryKey: QUERY_KEYS.materials,
    queryFn: () => materialService.listMaterials(),
  });

  const isLoading =
    accountsQuery.isLoading ||
    journalEntriesQuery.isLoading ||
    salesInvoicesQuery.isLoading ||
    purchaseInvoicesQuery.isLoading ||
    salesReturnsQuery.isLoading ||
    purchaseReturnsQuery.isLoading ||
    expenseAccountsQuery.isLoading ||
    materialsQuery.isLoading;

  const isError =
    accountsQuery.isError ||
    journalEntriesQuery.isError ||
    salesInvoicesQuery.isError ||
    purchaseInvoicesQuery.isError ||
    salesReturnsQuery.isError ||
    purchaseReturnsQuery.isError ||
    expenseAccountsQuery.isError ||
    materialsQuery.isError;

  const isRefetching =
    accountsQuery.isRefetching ||
    journalEntriesQuery.isRefetching ||
    salesInvoicesQuery.isRefetching ||
    purchaseInvoicesQuery.isRefetching ||
    salesReturnsQuery.isRefetching ||
    purchaseReturnsQuery.isRefetching ||
    expenseAccountsQuery.isRefetching ||
    materialsQuery.isRefetching;

  return {
    isLoading,
    isError,
    isRefetching,
    data: {
      accounts: accountsQuery.data ?? [],
      entries: journalEntriesQuery.data ?? [],
      salesInvoices: salesInvoicesQuery.data ?? [],
      purchaseInvoices: purchaseInvoicesQuery.data ?? [],
      salesReturns: salesReturnsQuery.data ?? [],
      purchaseReturns: purchaseReturnsQuery.data ?? [],
      expenseAccounts: expenseAccountsQuery.data ?? [],
      materials: materialsQuery.data ?? [],
    },
    refetch: async () => {
      await Promise.all([
        accountsQuery.refetch(),
        journalEntriesQuery.refetch(),
        salesInvoicesQuery.refetch(),
        purchaseInvoicesQuery.refetch(),
        salesReturnsQuery.refetch(),
        purchaseReturnsQuery.refetch(),
        expenseAccountsQuery.refetch(),
        materialsQuery.refetch(),
      ]);
    }
  };
}
