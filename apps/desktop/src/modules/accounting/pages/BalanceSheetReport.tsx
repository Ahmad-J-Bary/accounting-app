import { useCallback, useMemo } from "react";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { computeBalanceSheet } from "@modules/accounting/lib/balanceSheet";
import { useBalanceSheetReport } from "@modules/accounting/hooks/useBalanceSheetReport";
import { BalanceSheetView } from "@modules/accounting/components/balance-sheet/BalanceSheetView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";

export default function BalanceSheetReport() {
  const { baseCurrency, formatAmount } = useCurrencyContext();
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
    <ReportLayout
      title="الميزانية العمومية"
      filters={
        <ReportFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          loading={loading}
          refreshing={refreshing}
          onRefresh={loadReportData}
          selectedCurrencyLabel={selectedCurrency}
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
          <BalanceSheetView
            computed={computed}
            filters={filters}
            formatValue={formatValue}
          />
        )}
      </div>
    </ReportLayout>
  );
}
