import { useQuery } from "@tanstack/react-query";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { accountingService } from "@modules/accounting/api/accountingService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { toUtcBound } from "@shared/lib/format";
import type { JournalEntryDto, ReceivablesPayablesSummary, AccountDto, TrialBalanceDto, ProfitLossDto } from "@erp/shared-types";

export function useJournalEntries(filters: { from_date: string; to_date: string }) {
  return useQuery<JournalEntryDto[]>({
    queryKey: QUERY_KEYS.journalEntries(filters),
    queryFn: () =>
      journalEntryService.listJournalEntries({
        from_date: toUtcBound(filters.from_date, false),
        to_date: toUtcBound(filters.to_date, true),
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
    trialBalance: TrialBalanceDto;
  }>({
    queryKey: QUERY_KEYS.trialBalance(filters?.from_date, filters?.to_date),
    queryFn: async () => {
      const [accounts, trialBalance] = await Promise.all([
        accountingService.getChartOfAccounts(),
        accountingService.getTrialBalance(filters?.from_date, filters?.to_date),
      ]);
      return { accounts, trialBalance };
    },
  });
}

export function useIncomeStatement(filters?: { from_date?: string; to_date?: string }) {
  return useQuery<ProfitLossDto>({
    queryKey: QUERY_KEYS.incomeStatement(filters?.from_date, filters?.to_date),
    queryFn: () =>
      accountingService.getIncomeStatement(filters?.from_date, filters?.to_date),
  });
}
