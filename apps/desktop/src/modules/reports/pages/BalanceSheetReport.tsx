import { useCallback, useMemo } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { computeBalanceSheet } from "@modules/reports/lib/balanceSheet";
import { useBalanceSheetReport } from "@modules/reports/hooks/useBalanceSheetReport";
import { useBalanceSheet } from "@shared/hooks/queries/useReportQueries";
import { BalanceSheetView } from "@modules/reports/components/BalanceSheetView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { ReportLoadingSkeleton } from "@widgets/reports";

export default function BalanceSheetReport() {
  const { baseCurrency, currencies, formatAmount, hasMultipleCurrencies } = useCurrencyContext();
  const {
    filters,
    setFilters,
    selectedCurrency,
    setSelectedCurrency,
  } = useReportFilters(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );

  const { isLoading: bsLoading, isRefetching: bsRefetching, data: bsData, dataUpdatedAt: bsUpdatedAt, refetch: bsRefetch } = useBalanceSheet();
  const { loading: enrichmentLoading, reportData } = useBalanceSheetReport(filters);

  const loading = bsLoading || enrichmentLoading;
  const refreshing = bsRefetching;
  const lastLoadedAt = bsUpdatedAt ? new Date(bsUpdatedAt) : null;

  const computed = useMemo(() => {
    if (!bsData) return null;

    // Convert backend BalanceSheetDto to the ledgerTotals format computeBalanceSheet expects
    const backendLedgerTotals = new Map<string, { debit: number; credit: number }>();
    const allBackendLines = [...bsData.assets, ...bsData.liabilities, ...bsData.equity];
    for (const line of allBackendLines) {
      const net = parseFloat(line.amount) || 0;
      if (net >= 0) {
        backendLedgerTotals.set(line.account_id, { debit: net, credit: 0 });
      } else {
        backendLedgerTotals.set(line.account_id, { debit: 0, credit: -net });
      }
    }

    // Use backend net_profit if available; totalDrawings is already included
    // in total_equity (DRAWINGS account is Equity type with negative balance)
    const netProfit = bsData.net_profit ? parseFloat(bsData.net_profit) || 0 : 0;

    return computeBalanceSheet(
      reportData.accounts,
      { netProfit, totalDrawings: 0 },
      backendLedgerTotals,
      { closingInventory: reportData.closingInventory },
    );
  }, [bsData, reportData.accounts, reportData.closingInventory]);

  const formatValue = useCallback(
    (value: number) =>
      formatAmount(value, {
        currencyCode: selectedCurrency || baseCurrency?.code,
        withCode: true,
      }),
    [formatAmount, selectedCurrency, baseCurrency],
  );

  return (
    <OperationalTableTemplate
      title="الميزانية العمومية"
      toolbar={
        <ReportFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          showCurrencySelect={hasMultipleCurrencies}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
          currencies={currencies}
          baseCurrencyCode={baseCurrency?.code}
          refreshing={refreshing}
          onRefresh={() => void bsRefetch()}
          lastLoadedAt={lastLoadedAt}
        />
      }
      tableContent={
        loading ? (
          <ReportLoadingSkeleton />
        ) : computed ? (
          <BalanceSheetView
            computed={computed}
            filters={filters}
            formatValue={formatValue}
          />
        ) : null
      }
    />
  );
}
