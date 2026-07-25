import { useEffect, useState } from "react";
import { useTrialBalance } from "@shared/hooks/queries/useReportQueries";
import type { AccountDto } from "@erp/shared-types";
import type { ReportFilters } from "@shared/types/filters";
import type { ReportState } from "@shared/types/report";

export type LoadedTrialBalanceData = {
  accounts: AccountDto[];
  ledgerTotals: Map<string, { debit: number; credit: number }>;
};

const emptyData: LoadedTrialBalanceData = {
  accounts: [],
  ledgerTotals: new Map(),
};

export function useTrialBalanceReport(filters: ReportFilters): ReportState<LoadedTrialBalanceData> {
  const { data, isLoading, isRefetching, refetch, isFetched } = useTrialBalance(filters);

  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (isFetched && data) {
      setLastLoadedAt(new Date());
    }
  }, [isFetched, data]);

  return {
    loading: isLoading,
    refreshing: isRefetching,
    lastLoadedAt,
    reportData: data ?? emptyData,
    loadReportData: async () => { await refetch(); },
  };
}
