import { useCallback, useMemo } from "react";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Users } from "lucide-react";
import { computePartnerProfitShare } from "@modules/accounting/lib/partnerProfitShare";
import { computePartnerStatement } from "@modules/accounting/lib/partnerStatement";
import { usePartnerProfitShareReport } from "@modules/accounting/hooks/usePartnerProfitShareReport";
import { PartnerStatementView } from "@modules/accounting/components/partner-statement/PartnerStatementView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { useReportFilters } from "@shared/hooks/useReportFilters";

export default function PartnerStatementReport() {
  const { baseCurrency, currencies, formatAmount } = useCurrencyContext();
  const {
    filters,
    setFilters,
    selectedCurrency,
    setSelectedCurrency,
  } = useReportFilters(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );
  const { loading, refreshing, lastLoadedAt, reportData, loadReportData } = usePartnerProfitShareReport(filters);

  const fromTs = useMemo(() => new Date(`${filters.from_date}T00:00:00`).getTime(), [filters.from_date]);

  const profitShare = useMemo(() => {
    return computePartnerProfitShare(
      reportData.partners,
      reportData.netProfit,
      reportData.inventoryValue,
      reportData.fixedAssetsValue,
      reportData.partnerDrawings,
      reportData.customerDebts,
    );
  }, [reportData]);

  const thisYearProfitShare: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of profitShare.rows) {
      map[row.partnerId] = row.profitShareAmount;
    }
    return map;
  }, [profitShare]);

  const computed = useMemo(() => {
    return computePartnerStatement(
      reportData.partners,
      fromTs,
      reportData.partnerLedgers,
      thisYearProfitShare,
      reportData.partnerDrawings,
    );
  }, [reportData, fromTs, thisYearProfitShare]);

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
      title="كشف حساب الشريك"
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
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-6 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : computed.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="mb-3 h-12 w-12" />
            <p className="text-sm font-bold">لا يوجد شركاء لعرض كشف الحساب</p>
          </div>
        ) : (
          <PartnerStatementView
            computed={computed}
            formatValue={formatValue}
          />
        )}
      </div>
    </ReportLayout>
  );
}
