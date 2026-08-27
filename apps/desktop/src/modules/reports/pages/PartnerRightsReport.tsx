import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Coins } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Users } from "lucide-react";
import { PartnerProfitShareView } from "@modules/reports/components/PartnerProfitShareView";
import { PartnerStatementView } from "@modules/reports/components/PartnerStatementView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { ReportLoadingSkeleton, ReportErrorState } from "@widgets/reports";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { useDistributionSource } from "@modules/accounting/profit-distribution/hooks/useDistributionSource";
import { useDistributionPool } from "@modules/accounting/profit-distribution/hooks/useDistributionPool";
import { usePartnerRightsReport } from "@modules/reports/hooks/usePartnerRightsReport";
import { ProfitDistributionWorkflow } from "@modules/accounting/profit-distribution/components/ProfitDistributionWorkflow";

export default function PartnerRightsReport() {
  const { baseCurrency, currencies, formatAmount, hasMultipleCurrencies } = useCurrencyContext();
  const { filters, setFilters, selectedCurrency, setSelectedCurrency } = useReportFilters(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );
  const { loading, refreshing, lastLoadedAt, reportData, error, loadReportData, computed } = usePartnerRightsReport(filters);

  const [showProfitDistribution, setShowProfitDistribution] = useState(false);

  const { source, sourceLabel, windowStart, windowEnd, isLoading: sourceLoading } = useDistributionSource();
  const { pool, isLoading: poolLoading } = useDistributionPool(source, windowStart, windowEnd);

  const formatValue = (value: number) =>
    formatAmount(value, {
      currencyCode: selectedCurrency || baseCurrency?.code,
      withCode: true,
    });

  return (
    <>
      <OperationalTableTemplate
        title="الشركاء وحقوقهم"
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
              <Button
                size="sm"
                className="h-9 rounded-lg bg-white font-black text-slate-700 border border-slate-200 hover:bg-slate-50"
                onClick={() => setShowProfitDistribution(true)}
              >
                <Coins className="ml-2 h-4 w-4" />
                توزيع الأرباح
              </Button>
            }
          />
        }
        tableContent={
          loading || sourceLoading ? (
            <ReportLoadingSkeleton />
          ) : error ? (
            <ReportErrorState onRetry={loadReportData} />
          ) : reportData.partners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="mb-3 h-12 w-12" />
              <p className="text-sm font-bold">لا يوجد شركاء نشطون لعرض التقرير</p>
            </div>
          ) : (
            <Tabs defaultValue="profit-share" className="flex flex-col h-full">
              <div className="px-4 pt-3">
                <TabsList>
                  <TabsTrigger value="profit-share">تقاسم الأرباح</TabsTrigger>
                  <TabsTrigger value="statement">كشف الحساب</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="profit-share" className="flex-1 min-h-0 mt-0">
                <PartnerProfitShareView computed={computed.profitShare} formatValue={formatValue} />
              </TabsContent>
              <TabsContent value="statement" className="flex-1 min-h-0 mt-0">
                <PartnerStatementView computed={computed.statement} formatValue={formatValue} />
              </TabsContent>
            </Tabs>
          )
        }
      />
      {showProfitDistribution && (
        <ProfitDistributionSidePanel
          source={source}
          sourceLabel={sourceLabel}
          pool={pool}
          poolLoading={poolLoading}
          windowStart={windowStart}
          windowEnd={windowEnd}
          onClose={() => setShowProfitDistribution(false)}
        />
      )}
    </>
  );
}

function ProfitDistributionSidePanel({
  source,
  sourceLabel,
  pool,
  poolLoading,
  windowStart,
  windowEnd,
  onClose,
}: {
  source: import("@modules/accounting/api/openingBalanceService").ProfitDistributionSource | null;
  sourceLabel: string;
  pool: import("@modules/accounting/profit-distribution/lib/types").DistributionPool | null;
  poolLoading: boolean;
  windowStart: string;
  windowEnd: string;
  onClose: () => void;
}) {
  if (!source) {
    return (
      <div className="fixed inset-y-0 left-0 w-[480px] bg-white border-r shadow-xl z-50 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-lg">توزيع الأرباح</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-slate-500 text-center">
            لا توجد مصدر أرباح متاحة. يجب ترحيل الرصيد الافتتاحي أو إغلاق فترة مالية أولاً.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 left-0 w-[480px] bg-white border-r shadow-xl z-50 flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-bold text-lg">توزيع الأرباح</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {poolLoading ? (
          <p className="text-sm text-slate-400">جارٍ تحميل البيانات...</p>
        ) : pool ? (
          <ProfitDistributionWorkflow
            source={source}
            windowStart={windowStart}
            windowEnd={windowEnd}
            sourceLabel={sourceLabel}
          />
        ) : (
          <p className="text-sm text-slate-400">لا توجد بيانات متاحة</p>
        )}
      </div>
    </div>
  );
}
