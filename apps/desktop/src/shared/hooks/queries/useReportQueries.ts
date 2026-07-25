import { useQuery } from "@tanstack/react-query";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { accountingService } from "@modules/accounting/api/accountingService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { computeLedgerTotals, type AccountLedgerTotal } from "@modules/reports/lib/ledgerTotals";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { JournalEntryDto, ReceivablesPayablesSummary, AccountDto, InvoiceDto } from "@erp/shared-types";

export function useJournalEntries(filters: { from_date: string; to_date: string }) {
  return useQuery<JournalEntryDto[]>({
    queryKey: QUERY_KEYS.journalEntries(filters),
    queryFn: () =>
      journalEntryService.listJournalEntries({
        from_date: filters.from_date,
        to_date: filters.to_date,
      }),
  });
}

export function useReceivablesPayables() {
  return useQuery<ReceivablesPayablesSummary>({
    queryKey: QUERY_KEYS.receivablesPayables,
    queryFn: () => accountingService.getReceivablesPayablesSummary(),
  });
}

export function useTrialBalance(filters?: { from_date?: string; to_date?: string }) {
  return useQuery<{
    accounts: AccountDto[];
    ledgerTotals: Map<string, AccountLedgerTotal>;
  }>({
    queryKey: QUERY_KEYS.trialBalance(filters),
    queryFn: async () => {
      const [accounts, entries] = await Promise.all([
        accountingService.getChartOfAccounts(),
        journalEntryService.listJournalEntries({}),
      ]);

      let purchaseInvoices: InvoiceDto[] = [];
      try {
        purchaseInvoices = await invoiceService.listInvoicesByType("Purchase");
      } catch (e) {
        console.warn("Purchase invoices fetch failed in trial balance loader:", e);
      }

      const { ledgerTotals } = computeLedgerTotals(
        accounts,
        entries,
        purchaseInvoices,
        filters?.from_date,
        filters?.to_date,
      );
      return { accounts, ledgerTotals };
    },
  });
}
