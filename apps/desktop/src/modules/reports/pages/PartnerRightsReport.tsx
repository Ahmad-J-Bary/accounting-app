import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Coins, Users } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { PartnerProfitShareView } from "@modules/reports/components/PartnerProfitShareView";
import { PartnerStatementView } from "@modules/reports/components/PartnerStatementView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { ReportLoadingSkeleton, ReportErrorState } from "@widgets/reports";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { usePartnerRightsReport } from "@modules/reports/hooks/usePartnerRightsReport";
import { ProfitDistributionSidePanel } from "@modules/accounting/profit-distribution/components/ProfitDistributionSidePanel";

export default function PartnerRightsReport() {
  const { baseCurrency, currencies, formatAmount, hasMultipleCurrencies } = useCurrencyContext();
  const { filters, setFilters, selectedCurrency, setSelectedCurrency } = useReportFilters(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );
  const { loading, refreshing, lastLoadedAt, error, loadReportData, computed } = usePartnerRightsReport(filters);

  const [showProfitDistribution, setShowProfitDistribution] = useState(false);

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
                <Coins className="me-2 h-4 w-4" />
                توزيع الأرباح
              </Button>
            }
          />
        }
        tableContent={
          loading ? (
            <ReportLoadingSkeleton />
          ) : error ? (
            <ReportErrorState onRetry={loadReportData} />
          ) : computed.profitShare.rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="mb-3 h-12 w-12" />
              <p className="text-sm font-bold">لا يوجد شركاء نشطون لعرض التقرير</p>
            </div>
          ) : (
            <Tabs defaultValue="profit-share" className="flex flex-col h-full" dir="rtl">
              <div className="px-4 pt-3">
                <TabsList className="bg-white border border-slate-200 p-1 h-11 rounded-xl shadow-sm">
                  <TabsTrigger value="profit-share" className="rounded-lg px-5 gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all font-bold">تقاسم الأرباح</TabsTrigger>
                  <TabsTrigger value="statement" className="rounded-lg px-5 gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all font-bold">كشف الحساب</TabsTrigger>
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
      <ProfitDistributionSidePanel
        isOpen={showProfitDistribution}
        onClose={() => setShowProfitDistribution(false)}
      />
    </>
  );
}
