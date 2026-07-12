import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { Button } from "@shared/ui/button";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { RefreshCw, Users, BookOpen } from "lucide-react";
import { computePartnerProfitShare } from "@modules/accounting/lib/partnerProfitShare";
import { usePartnerProfitShareReport } from "@modules/accounting/hooks/usePartnerProfitShareReport";
import { PartnerProfitShareView } from "@modules/accounting/components/partner-profit-share/PartnerProfitShareView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { useReportFilters } from "@shared/hooks/useReportFilters";

export default function PartnerProfitShareReport() {
  const navigate = useNavigate();
  const { baseCurrency, currencies, formatAmount } = useCurrencyContext();
  const { filters, setFilters, selectedCurrency, setSelectedCurrency } = useReportFilters(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );
  const { loading, refreshing, lastLoadedAt, reportData, loadReportData } = usePartnerProfitShareReport(filters);

  const computed = useMemo(() => {
    return computePartnerProfitShare(
      reportData.partners,
      reportData.netProfit,
      reportData.inventoryValue,
      reportData.fixedAssetsValue,
      reportData.partnerDrawings,
      reportData.customerDebts,
    );
  }, [reportData]);

  const formatValue = (value: number) =>
    formatAmount(value, {
      currencyCode: selectedCurrency || baseCurrency?.code,
      withCode: true,
    });

  const selectedCurrencyLabel = useMemo(() => {
    const activeCurrency = currencies.find((currency) => currency.code === (selectedCurrency || baseCurrency?.code));
    return activeCurrency
      ? `${activeCurrency.name} (${activeCurrency.symbol || activeCurrency.code})`
      : selectedCurrency || baseCurrency?.code || "—";
  }, [currencies, selectedCurrency, baseCurrency]);

  return (
    <ReportLayout
      title="الشركاء وتقاسم الأرباح"
      filters={
        <ReportFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          loading={loading}
          refreshing={refreshing}
          onRefresh={loadReportData}
          selectedCurrencyLabel={selectedCurrencyLabel}
          lastLoadedAt={lastLoadedAt}
          extraFilters={
            <div className="flex items-end gap-2">
              <Button
                className="h-11 rounded-xl bg-white font-black text-slate-700 border border-slate-200 hover:bg-slate-50 flex-1"
                onClick={() => navigate("/accounting/reports/partner-statement")}
              >
                <BookOpen className="ml-2 h-4 w-4" />
                كشف حساب تفصيلي
              </Button>
            </div>
          }
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
        ) : computed.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="mb-3 h-12 w-12" />
            <p className="text-sm font-bold">لا يوجد شركاء نشطون لعرض التقرير</p>
          </div>
        ) : (
          <PartnerProfitShareView
            computed={computed}
            formatValue={formatValue}
          />
        )}
      </div>
    </ReportLayout>
  );
}