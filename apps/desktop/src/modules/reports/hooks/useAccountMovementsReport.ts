import { useEffect, useMemo, useState } from "react";
import { useChartOfAccounts, useAccountLedger } from "@shared/hooks/queries/useAccountQueries";
import type { AccountDto, AccountLedgerLineDto } from "@erp/shared-types";
import type { ReportFilters } from "@shared/types/filters";
import type { ReportState } from "@shared/types/report";

export type LoadedAccountMovementsData = {
  accounts: AccountDto[];
  accountName: string;
  openingBalance: number;
  filteredLines: AccountLedgerLineDto[];
  totals: { debit: number; credit: number };
  periodClosingBalance: number;
};

export function useAccountMovementsReport(
  accountIds: string[] | undefined,
  filters: ReportFilters,
): ReportState<LoadedAccountMovementsData> {
  const { data: accounts = [] } = useChartOfAccounts();
  const { data: ledger, isLoading, isRefetching, refetch, isFetched } = useAccountLedger(accountIds);

  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (isFetched && ledger) {
      setLastLoadedAt(new Date());
    }
  }, [isFetched, ledger]);

  const reportData = useMemo<LoadedAccountMovementsData>(() => {
    const lines = ledger?.lines ?? [];
    const openingBalance = parseFloat(ledger?.opening_balance_base || "0");

    const filteredLines = lines.filter((l) => {
      const d = new Date(l.date).toISOString().split("T")[0];
      return d >= filters.from_date && d <= filters.to_date;
    });

    const totals = filteredLines.reduce(
      (acc, l) => {
        acc.debit += parseFloat(l.debit_base || "0");
        acc.credit += parseFloat(l.credit_base || "0");
        return acc;
      },
      { debit: 0, credit: 0 },
    );

    const periodClosingBalance = openingBalance + totals.debit - totals.credit;

    return {
      accounts,
      accountName: ledger?.account_name || "",
      openingBalance,
      filteredLines,
      totals,
      periodClosingBalance,
    };
  }, [ledger, accounts, filters]);

  return {
    loading: isLoading,
    refreshing: isRefetching,
    lastLoadedAt,
    reportData,
    loadReportData: async () => { await refetch(); },
  };
}
