import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Users, BookOpen } from "lucide-react";
import { computePartnerProfitShare } from "@modules/reports/lib/partnerProfitShare";
import { usePartnerProfitShareReport } from "@modules/reports/hooks/usePartnerProfitShareReport";
import { PartnerProfitShareView } from "@modules/reports/components/PartnerProfitShareView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { ReportLoadingSkeleton, ReportErrorState } from "@widgets/reports";
import { useReportFilters } from "@shared/hooks/useReportFilters";

export default function PartnerProfitShareReport() {
  const navigate = useNavigate();
  const { baseCurrency, currencies, formatAmount, hasMultipleCurrencies } = useCurrencyContext();
  const { filters, setFilters, selectedCurrency, setSelectedCurrency } = useReportFilters(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );
  const { loading, reportData, error, loadReportData } = usePartnerProfitShareReport(filters);

  const computed = useMemo(() => {
    return computePartnerProfitShare(
      reportData.partners,
      reportData.netProfit,
      reportData.inventoryValue,
      reportData.fixedAssetsValue,
      reportData.partnerDrawings,
      reportData.customerDebts,
      reportData.partnerLedgers,
      filters.to_date,
    );
  }, [reportData, filters.to_date]);

  const formatValue = (value: number) =>
    formatAmount(value, {
      currencyCode: selectedCurrency || baseCurrency?.code,
      withCode: true,
    });

  return (
    <OperationalTableTemplate
      title="الشركاء وتقاسم الأرباح"
      toolbar={
        <ReportFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          showCurrencySelect={hasMultipleCurrencies}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
          currencies={currencies}
          baseCurrencyCode={baseCurrency?.code}
          extraFilters={
            <Button
              size="sm"
              className="h-9 rounded-lg bg-white font-black text-slate-700 border border-slate-200 hover:bg-slate-50"
              onClick={() => navigate("/accounting/reports/partner-statement")}
            >
              <BookOpen className="ml-2 h-4 w-4" />
              كشف حساب تفصيلي
            </Button>
          }
        />
      }
      tableContent={
        loading ? (
          <ReportLoadingSkeleton />
        ) : error ? (
          <ReportErrorState onRetry={loadReportData} />
        ) : reportData.partners.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="mb-3 h-12 w-12" />
            <p className="text-sm font-bold">لا يوجد شركاء نشطون لعرض التقرير</p>
          </div>
        ) : (
          <PartnerProfitShareView
            computed={computed}
            formatValue={formatValue}
          />
        )
      }
    />
  );
}
