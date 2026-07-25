import { useCallback, useMemo } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { computeIncomeStatement } from "@modules/reports/lib/incomeStatement";
import { useIncomeStatementReport } from "@modules/reports/hooks/useIncomeStatementReport";
import { IncomeStatementView } from "@modules/reports/components/IncomeStatementView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { ReportLoadingSkeleton } from "@widgets/reports";

export default function IncomeStatementReport() {
  const { baseCurrency, currencies, formatAmount, hasMultipleCurrencies } = useCurrencyContext();
  const {
    filters,
    setFilters,
    selectedCurrency,
    setSelectedCurrency,
  } = useReportFilters(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );
  const { loading, lastLoadedAt, reportData } = useIncomeStatementReport();

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
    <OperationalTableTemplate
      title="قائمة الدخل"
      toolbar={
        <ReportFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          showCurrencySelect={hasMultipleCurrencies}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
          currencies={currencies}
          baseCurrencyCode={baseCurrency?.code}
        />
      }
      tableContent={
        loading ? (
          <ReportLoadingSkeleton />
        ) : (
          <IncomeStatementView
              computed={computed}
              filters={filters}
              selectedCurrencyLabel={selectedCurrencyLabel}
              lastLoadedAt={lastLoadedAt}
              formatValue={formatValue}
            />
        )
      }
    />
  );
}
