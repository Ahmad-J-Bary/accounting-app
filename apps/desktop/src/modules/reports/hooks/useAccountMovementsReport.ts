import { useEffect, useMemo, useState } from "react";
import { useChartOfAccounts, useAccountLedger } from "@shared/hooks/queries/useAccountQueries";
import type { AccountDto, AccountLedgerLineDto, OpeningEntryDto } from "@erp/shared-types";
import type { ReportFilters } from "@shared/types/filters";
import type { ReportState } from "@shared/types/report";
import { getOpeningCreationDate, getOpeningTotals, isOpeningLine } from "@modules/accounting/account-movements/lib/openingLines";

export type LoadedAccountMovementsData = {
  accounts: AccountDto[];
  accountName: string;
  openingBalance: number;
  openingEntry: OpeningEntryDto | null;
  openingBalanceDate: string;
  filteredLines: AccountLedgerLineDto[];
  totals: { debit: number; credit: number };
  periodClosingBalance: number;
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
      const d = (oe.date || "").split("T")[0];
      if (from && d < from) return null;
      if (to && d > to) return null;
    }
    return oe;
  }, [ledger, filters]);

  const reportData = useMemo<LoadedAccountMovementsData>(() => {
    const lines = ledger?.lines ?? [];

    const openingBalance = (() => {
      let absOpening = parseFloat(ledger?.opening_balance_base || "0");

      // The opening balance only exists once its opening entry was created.
      // If the period ends before that creation date, the balance did not
      // exist yet — hide it instead of "going back in time".
      if (filters.to_date) {
        const created = getOpeningCreationDate(ledger?.opening_entry, lines);
        if (created && created > filters.to_date) {
          absOpening = 0;
        }
      }

      if (!filters.from_date) return absOpening;

      let debitBefore = 0;
      let creditBefore = 0;
      for (const line of lines) {
        if (isOpeningLine(line)) continue;
        const d = line.date.split("T")[0];
        if (d < filters.from_date) {
          debitBefore += parseFloat(line.debit_base || "0");
          creditBefore += parseFloat(line.credit_base || "0");
        }
      }
      return absOpening + debitBefore - creditBefore;
    })();

    const openingBalanceDate = filters.from_date
      || (openingEntry?.date || "");

    const filteredLines = filters.from_date && filters.to_date
      ? lines.filter((l) => {
          const d = l.date.split("T")[0];
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

    const periodClosingBalance = openingBalance + totals.debit - totals.credit;

    const openingTotals = getOpeningTotals(lines, ledger?.opening_entries ?? [], filters.from_date, filters.to_date);

    return {
      accounts,
      accountName: ledger?.account_name || "",
      openingBalance,
      openingEntry,
      openingBalanceDate,
      filteredLines,
      totals,
      periodClosingBalance,
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
