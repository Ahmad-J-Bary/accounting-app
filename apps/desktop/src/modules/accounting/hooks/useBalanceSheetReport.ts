import { useEffect, useState } from "react";
import { useReportBaseData } from "@modules/accounting/hooks/useReportBaseData";
import { useMaterialExpenseLedgers } from "@shared/hooks/useMaterialExpenseLedgers";
import { computeIncomeStatement, emptyIncomeStatementData } from "@modules/accounting/lib/incomeStatement";
import { computeLedgerTotals } from "@modules/accounting/lib/ledgerTotals";
import type { AccountDto } from "@erp/shared-types";
import type { IncomeStatementFilters } from "@modules/accounting/lib/incomeStatement";
import type { ReportState } from "@shared/types/report";

export type LoadedBalanceSheetData = {
  accounts: AccountDto[];
  netProfit: number;
  totalDrawings: number;
  ledgerTotals: Map<string, { debit: number; credit: number }>;
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
  const { data: baseData, isLoading, isError, isRefetching, refetch } = useReportBaseData(filters);
  const { loadMaterialExpenseLedgers } = useMaterialExpenseLedgers();

  const [resolvedData, setResolvedData] = useState<LoadedBalanceSheetData>(emptyData);
  const [loadingLedgers, setLoadingLedgers] = useState(false);

  useEffect(() => {
    if (isLoading || isError || !baseData.materials.length) return;

    let active = true;
    const run = async () => {
      setLoadingLedgers(true);
      try {
        const { stockMovementsByMaterial, expenseLedgers } = await loadMaterialExpenseLedgers(
          baseData.materials,
          baseData.expenseAccounts
        );
        if (!active) return;

        const incomeStatementData = {
          ...emptyIncomeStatementData,
          ...baseData,
          expenseLedgers,
          stockMovementsByMaterial,
        };

        const incomeStatementResult = computeIncomeStatement(filters, incomeStatementData);

        const { ledgerTotals, totalDrawings } = computeLedgerTotals(
          baseData.accounts,
          baseData.entries,
          baseData.purchaseInvoices
        );

        setResolvedData({
          accounts: baseData.accounts,
          netProfit: incomeStatementResult.netProfit,
          totalDrawings,
          ledgerTotals,
          closingInventory: incomeStatementResult.closingInventory,
        });
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
  }, [baseData, isLoading, isError, filters, loadMaterialExpenseLedgers]);

  return {
    loading: isLoading || loadingLedgers,
    refreshing: isRefetching,
    lastLoadedAt: baseData.materials.length ? new Date() : null,
    reportData: resolvedData,
    loadReportData: refetch,
  };
}