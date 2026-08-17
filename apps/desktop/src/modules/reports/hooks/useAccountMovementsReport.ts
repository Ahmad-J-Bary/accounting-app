import { useEffect, useMemo, useState } from "react";
import { useChartOfAccounts, useAccountLedger } from "@shared/hooks/queries/useAccountQueries";
import type { AccountDto, AccountLedgerLineDto, OpeningEntryDto } from "@erp/shared-types";
import type { ReportFilters } from "@shared/types/filters";
import type { ReportState } from "@shared/types/report";
import { getOpeningTotals, isOpeningLine, computeOpeningBalance } from "@modules/accounting/account-movements/lib/openingLines";
import { toLocalDateStr } from "@shared/lib/format";

export type LoadedAccountMovementsData = {
  accounts: AccountDto[];
  accountName: string;
  openingBalance: number;
  openingEntry: OpeningEntryDto | null;
  openingEntries: OpeningEntryDto[];
  openingBalanceDate: string;
  filteredLines: AccountLedgerLineDto[];
  totals: { debit: number; credit: number };
  openingDebitTotal: number;
  openingCreditTotal: number;
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

  const openingEntry = useMemo<OpeningEntryDto | null>(() => {
    const oe = ledger?.opening_entry ?? null;
    if (!oe) return null;

    const from = filters.from_date;
    const to = filters.to_date;
    if (from || to) {
      const d = (oe.date || "") ? toLocalDateStr(oe.date || "") : "";
      if (from && d < from) return null;
      if (to && d > to) return null;
    }
    return oe;
  }, [ledger, filters]);

  const reportData = useMemo<LoadedAccountMovementsData>(() => {
    const lines = ledger?.lines ?? [];

    const openingBalance = computeOpeningBalance(
      lines,
      parseFloat(ledger?.opening_balance_base || "0"),
      filters.from_date,
      filters.to_date,
    );

    const openingBalanceDate = filters.from_date
      || (openingEntry?.date || "");

    const filteredLines = filters.from_date && filters.to_date
      ? lines.filter((l) => {
          const d = toLocalDateStr(l.date);
          return d >= filters.from_date && d <= filters.to_date;
        })
      : lines;

    const totals = filteredLines.reduce(
      (acc, l) => {
        if (isOpeningLine(l)) return acc;
        acc.debit += parseFloat(l.debit_base || "0");
        acc.credit += parseFloat(l.credit_base || "0");
        return acc;
      },
      { debit: 0, credit: 0 },
    );

    const openingTotals = getOpeningTotals(lines, filters.from_date, filters.to_date);

    return {
      accounts,
      accountName: ledger?.account_name || "",
      openingBalance,
      openingEntry,
      openingEntries: ledger?.opening_entries ?? [],
      openingBalanceDate,
      filteredLines,
      totals,
      openingDebitTotal: openingTotals.debit,
      openingCreditTotal: openingTotals.credit,
    };
  }, [ledger, accounts, filters, openingEntry]);

  return {
    loading: isLoading,
    refreshing: isRefetching,
    lastLoadedAt,
    reportData,
    loadReportData: async () => { await refetch(); },
  };
}
