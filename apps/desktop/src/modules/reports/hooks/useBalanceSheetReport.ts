import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportBaseData } from "@modules/reports/hooks/useReportBaseData";
import { useMaterialExpenseLedgers } from "@shared/hooks/useMaterialExpenseLedgers";
import { computeIncomeStatement, emptyIncomeStatementData } from "@modules/reports/lib/incomeStatement";
import { computeLedgerTotals } from "@modules/reports/lib/ledgerTotals";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { AccountDto } from "@erp/shared-types";
import type { IncomeStatementFilters } from "@modules/reports/lib/incomeStatement";
import type { ReportState } from "@shared/types/report";

import type { AccountLedgerTotal } from "@modules/reports/lib/ledgerTotals";

export type LoadedBalanceSheetData = {
  accounts: AccountDto[];
  netProfit: number;
  totalDrawings: number;
  ledgerTotals: Map<string, AccountLedgerTotal>;
  closingInventory: number;
};

const emptyData: LoadedBalanceSheetData = {
  accounts: [],
  netProfit: 0,
  totalDrawings: 0,
  ledgerTotals: new Map(),
  closingInventory: 0,
};

export function useBalanceSheetReport(filters: IncomeStatementFilters): ReportState<LoadedBalanceSheetData> {
  const { data: baseData, isLoading: baseLoading, isError: baseError, isRefetching: baseRefetching, refetch: baseRefetch } = useReportBaseData(filters);
  const { loadMaterialExpenseLedgers } = useMaterialExpenseLedgers();

  const allEntriesQuery = useQuery({
    queryKey: QUERY_KEYS.journalEntries({}),
    queryFn: () => journalEntryService.listPostedJournalEntries(),
  });

  const [resolvedData, setResolvedData] = useState<LoadedBalanceSheetData>(emptyData);
  const [loadingLedgers, setLoadingLedgers] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const isLoading = baseLoading || allEntriesQuery.isLoading;
  const isError = baseError || allEntriesQuery.isError;
  const isRefetching = baseRefetching || allEntriesQuery.isRefetching;

  useEffect(() => {
    if (isLoading || isError) return;

    let active = true;
    const run = async () => {
      setLoadingLedgers(true);
      try {
        const stockMovementsByMaterial = await loadMaterialExpenseLedgers(
          baseData.materials
        );
        if (!active) return;

        const incomeStatementData = {
          ...emptyIncomeStatementData,
          ...baseData,
          stockMovementsByMaterial,
        };

        const incomeStatementResult = computeIncomeStatement(filters, incomeStatementData);

        const { ledgerTotals, totalDrawings } = computeLedgerTotals(
          baseData.accounts,
          allEntriesQuery.data ?? [],
          filters.from_date,
          filters.to_date,
        );

        setResolvedData({
          accounts: baseData.accounts,
          netProfit: incomeStatementResult.netProfit,
          totalDrawings,
          ledgerTotals,
          closingInventory: incomeStatementResult.closingInventory,
        });
        setLastLoadedAt(new Date());
      } catch (e) {
        console.error("Failed to load balance sheet calculations:", e);
      } finally {
        if (active) setLoadingLedgers(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [baseData, isLoading, isError, filters, loadMaterialExpenseLedgers, allEntriesQuery.data]);

  return {
    loading: isLoading || loadingLedgers,
    refreshing: isRefetching,
    lastLoadedAt,
    reportData: resolvedData,
    loadReportData: async () => {
      await Promise.all([baseRefetch(), allEntriesQuery.refetch()]);
    },
  };
}
