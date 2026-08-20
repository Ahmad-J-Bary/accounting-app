import { useCallback, useMemo } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { computeBalanceSheet } from "@modules/reports/lib/balanceSheet";
import { useBalanceSheetReport } from "@modules/reports/hooks/useBalanceSheetReport";
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
  const { loading, refreshing, lastLoadedAt, reportData, loadReportData } = useBalanceSheetReport(filters);

  const computed = useMemo(() => {
    return computeBalanceSheet(
      reportData.accounts,
      {
        netProfit: reportData.netProfit,
        totalDrawings: reportData.totalDrawings,
      },
      reportData.ledgerTotals,
      { closingInventory: reportData.closingInventory },
    );
  }, [reportData]);

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
