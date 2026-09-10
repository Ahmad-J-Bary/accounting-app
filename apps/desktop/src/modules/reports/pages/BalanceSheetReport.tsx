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
  const { loading: legacyLoading, refreshing: legacyRefreshing, lastLoadedAt: legacyLastLoadedAt, reportData, loadReportData: legacyLoadReportData } = useBalanceSheetReport(filters);

  const loading = bsLoading || legacyLoading;
  const refreshing = bsRefetching || legacyRefreshing;
  const lastLoadedAt = bsUpdatedAt ? new Date(bsUpdatedAt) : legacyLastLoadedAt;
  const loadReportData = async () => {
    await Promise.all([bsRefetch(), legacyLoadReportData()]);
  };

  const computed = useMemo(() => {
    if (!bsData) {
      return computeBalanceSheet(
        reportData.accounts,
        {
          netProfit: reportData.netProfit,
          totalDrawings: reportData.totalDrawings,
        },
        reportData.ledgerTotals,
        { closingInventory: reportData.closingInventory },
      );
    }

    // Convert backend BalanceSheetDto to the ledgerTotals format computeBalanceSheet expects
    const backendLedgerTotals = new Map<string, { debit: number; credit: number }>();
    const allBackendLines = [...bsData.assets, ...bsData.liabilities, ...bsData.equity];
    for (const line of allBackendLines) {
      const net = parseFloat(line.amount) || 0;
      // Convert net to debit/credit format for computeBalanceSheet
      if (net >= 0) {
        backendLedgerTotals.set(line.account_id, { debit: net, credit: 0 });
      } else {
        backendLedgerTotals.set(line.account_id, { debit: 0, credit: -net });
      }
    }

    // Use backend net_profit if available; totalDrawings is already included
    // in total_equity (DRAWINGS account is Equity type with negative balance)
    const netProfit = bsData.net_profit ? parseFloat(bsData.net_profit) || 0 : reportData.netProfit;

    // Build accounts from backend data for the tree
    const accounts = reportData.accounts;

    return computeBalanceSheet(
      accounts,
      { netProfit, totalDrawings: 0 },
      backendLedgerTotals,
      { closingInventory: reportData.closingInventory },
    );
  }, [bsData, reportData]);

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
          onRefresh={() => void loadReportData()}
          lastLoadedAt={lastLoadedAt}
        />
      }
      tableContent={
        loading ? (
          <ReportLoadingSkeleton />
        ) : (
          <BalanceSheetView
              computed={computed}
              filters={filters}
              formatValue={formatValue}
            />
        )
      }
    />
  );
}
