import { useQuery } from "@tanstack/react-query";
import { accountingService } from "@modules/accounting/api/accountingService";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { computeLedgerTotals } from "@modules/reports/lib/ledgerTotals";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { AccountDto, AccountLedgerDto } from "@erp/shared-types";

export interface ChartOfAccountsTreeData {
  accounts: AccountDto[];
  ledgerTotals: Map<string, { debit: number; credit: number }>;
}

export function useChartOfAccounts() {
  return useQuery<AccountDto[]>({
    queryKey: QUERY_KEYS.chartOfAccounts,
    queryFn: () => accountingService.getChartOfAccounts(),
  });
}

export function useAccountLedger(accountIds: string[] | undefined) {
  return useQuery<AccountLedgerDto>({
    queryKey: QUERY_KEYS.accountLedger(accountIds?.join(",") ?? ""),
    queryFn: () => accountingService.getAccountLedger(accountIds!),
    enabled: !!accountIds?.length,
  });
}

export function useExpenseItems() {
  return useQuery<AccountDto[]>({
    queryKey: QUERY_KEYS.expenseItems,
    queryFn: () => accountingService.getExpenseItems(),
  });
}

export function useChartOfAccountsTree() {
  return useQuery<ChartOfAccountsTreeData>({
    queryKey: QUERY_KEYS.chartOfAccountsTree,
    queryFn: async () => {
      const [accounts, entries] = await Promise.all([
        accountingService.getChartOfAccounts(),
        journalEntryService.listJournalEntries({}),
      ]);

      let purchaseInvoices: Awaited<ReturnType<typeof invoiceService.listInvoicesByType>> = [];
      try {
        purchaseInvoices = await invoiceService.listInvoicesByType("Purchase");
      } catch (e) {
        console.warn("Purchase invoices fetch failed inside tree data loader:", e);
      }

      const { ledgerTotals } = computeLedgerTotals(accounts, entries, purchaseInvoices);
      return { accounts, ledgerTotals };
    },
  });
}

