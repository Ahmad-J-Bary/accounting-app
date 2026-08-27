import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@shared/ui/dialog";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Users, BookOpen, Coins } from "lucide-react";
import { computePartnerProfitShare } from "@modules/reports/lib/partnerProfitShare";
import { usePartnerProfitShareReport } from "@modules/reports/hooks/usePartnerProfitShareReport";
import { PartnerProfitShareView } from "@modules/reports/components/PartnerProfitShareView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { ReportLoadingSkeleton, ReportErrorState } from "@widgets/reports";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { openingBalanceService } from "@modules/accounting/api/openingBalanceService";
import { ProfitDistributionWorkflow } from "@modules/accounting/profit-distribution/components/ProfitDistributionWorkflow";

export default function PartnerProfitShareReport() {
  const navigate = useNavigate();
  const { baseCurrency, currencies, formatAmount, hasMultipleCurrencies } = useCurrencyContext();
  const { filters, setFilters, selectedCurrency, setSelectedCurrency } = useReportFilters(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );
  const { loading, refreshing, lastLoadedAt, reportData, error, loadReportData } = usePartnerProfitShareReport(filters);

  const [showProfitDistribution, setShowProfitDistribution] = useState(false);

  const { data: migrations = [] } = useQuery<import("@modules/accounting/api/openingBalanceService").OpeningBalanceMigrationDto[]>({
    queryKey: ["opening-balance-migrations"],
    queryFn: () => openingBalanceService.listMigrations(),
  });

  const profitDistributionSource = useMemo(() => {
    const latest = [...migrations]
      .filter((m) => m.status === "Posted" || m.status === "Locked")
      .sort((a, b) => b.cutover_date.localeCompare(a.cutover_date))[0];
    if (!latest) return null;
    return {
      source: { OpeningMigration: { migration_id: latest.id } } as const,
      windowStart: "1970-01-01T00:00:00Z",
      windowEnd: `${latest.cutover_date}T23:59:59Z`,
      sourceLabel: `ترحيل الرصيد الافتتاحي — ${latest.cutover_date}`,
    };
  }, [migrations]);

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
    <>
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
          refreshing={refreshing}
          onRefresh={() => void loadReportData()}
          lastLoadedAt={lastLoadedAt}
          extraFilters={
            <>
              <Button
                size="sm"
                className="h-9 rounded-lg bg-white font-black text-slate-700 border border-slate-200 hover:bg-slate-50"
                onClick={() => setShowProfitDistribution(true)}
              >
                <Coins className="ml-2 h-4 w-4" />
                توزيع الأرباح
              </Button>
              <Button
                size="sm"
                className="h-9 rounded-lg bg-white font-black text-slate-700 border border-slate-200 hover:bg-slate-50"
                onClick={() => navigate("/accounting/reports/partner-statement")}
              >
                <BookOpen className="ml-2 h-4 w-4" />
                كشف حساب تفصيلي
              </Button>
            </>
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
      <Dialog open={showProfitDistribution} onOpenChange={setShowProfitDistribution}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>توزيع الأرباح</DialogTitle>
            <DialogDescription>
              توزيع الأرباح المتاحة على الشركاء وفقاً لنسب التقاسم
            </DialogDescription>
          </DialogHeader>
          {profitDistributionSource ? (
            <ProfitDistributionWorkflow
              source={profitDistributionSource.source}
              windowStart={profitDistributionSource.windowStart}
              windowEnd={profitDistributionSource.windowEnd}
              sourceLabel={profitDistributionSource.sourceLabel}
            />
          ) : (
            <p className="text-sm text-slate-500 py-4">
              لا توجد ترحيلات رصيد افتتاحي متاحة. يجب ترحيل الرصيد الافتتاحي أولاً قبل توزيع الأرباح.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
