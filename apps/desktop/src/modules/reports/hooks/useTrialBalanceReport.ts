import { useEffect, useState } from "react";
import { useTrialBalance } from "@shared/hooks/queries/useReportQueries";
import type { AccountDto, TrialBalanceDto } from "@erp/shared-types";
import type { ReportFilters } from "@shared/types/filters";
import type { ReportState } from "@shared/types/report";

export type LoadedTrialBalanceData = {
  accounts: AccountDto[];
  trialBalance: TrialBalanceDto;
};

const emptyData: LoadedTrialBalanceData = {
  accounts: [],
  trialBalance: {
    lines: [],
    total_debit: "0",
    total_credit: "0",
    generated_at: "",
    total_opening_debit: "0",
    total_opening_credit: "0",
    total_period_debit: "0",
    total_period_credit: "0",
  },
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
