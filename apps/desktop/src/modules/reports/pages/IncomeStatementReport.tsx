import { useCallback, useMemo } from "react";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { computeIncomeStatement } from "@modules/reports/lib/incomeStatement";
import { useIncomeStatementReport } from "@modules/reports/hooks/useIncomeStatementReport";
import { IncomeStatementView } from "@modules/reports/components/IncomeStatementView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";

export default function IncomeStatementReport() {
  const { baseCurrency, currencies, formatAmount } = useCurrencyContext();
  const {
    filters,
    setFilters,
    selectedCurrency,
  } = useReportFilters(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );
  const { loading, refreshing, lastLoadedAt, reportData, loadReportData } = useIncomeStatementReport();

  const computed = useMemo(() => {
    return computeIncomeStatement(filters, reportData);
  }, [filters, reportData]);

  const formatValue = useCallback(
    (value: number) =>
      formatAmount(value, {
        currencyCode: selectedCurrency || baseCurrency?.code,
        withCode: true,
      }),
    [formatAmount, selectedCurrency, baseCurrency],
  );

  const selectedCurrencyLabel = useMemo(() => {
    const activeCurrency = currencies.find((currency) => currency.code === (selectedCurrency || baseCurrency?.code));
    return activeCurrency
      ? `${activeCurrency.name} (${activeCurrency.symbol || activeCurrency.code})`
      : selectedCurrency || baseCurrency?.code || "—";
  }, [currencies, selectedCurrency, baseCurrency]);

  return (
    <ReportLayout
      title="????? ?????"
      filters={
        <ReportFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          loading={loading}
          refreshing={refreshing}
          onRefresh={loadReportData}
          selectedCurrencyLabel={selectedCurrencyLabel}
          lastLoadedAt={lastLoadedAt}
        />
      }
    >
      <div className="flex flex-1 flex-col p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="space-y-3 text-sm text-slate-500">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="h-6 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <IncomeStatementView
            computed={computed}
            filters={filters}
            selectedCurrencyLabel={selectedCurrencyLabel}
            lastLoadedAt={lastLoadedAt}
            formatValue={formatValue}
          />
        )}
      </div>
    </ReportLayout>
  );
}
