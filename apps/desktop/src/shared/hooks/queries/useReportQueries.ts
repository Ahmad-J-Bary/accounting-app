import { useQuery } from "@tanstack/react-query";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { accountingService } from "@modules/accounting/api/accountingService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { JournalEntryDto, ReceivablesPayablesSummary } from "@erp/shared-types";

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
