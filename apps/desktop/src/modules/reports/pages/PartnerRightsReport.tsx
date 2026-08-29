import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
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

type ViewMode = "profit-share" | "statement";

const VIEW_OPTIONS: Record<ViewMode, string> = {
  "profit-share": "تقاسم الأرباح",
  "statement": "كشف الحساب",
};

export default function PartnerRightsReport() {
  const { baseCurrency, currencies, formatAmount, hasMultipleCurrencies } = useCurrencyContext();
  const { filters, setFilters, selectedCurrency, setSelectedCurrency } = useReportFilters(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );
  const { loading, refreshing, lastLoadedAt, error, loadReportData, computed } = usePartnerRightsReport(filters);

  const [showProfitDistribution, setShowProfitDistribution] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("profit-share");

  const formatValue = (value: number) =>
    formatAmount(value, {
      currencyCode: selectedCurrency || baseCurrency?.code,
      withCode: true,
    });

  const viewSwitcher = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">العرض:</span>
      <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <SelectTrigger className="w-[125px] h-8 bg-white font-bold shadow-sm border-slate-200 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(VIEW_OPTIONS).map(([value, label]) => (
            <SelectItem key={value} value={value} className="text-xs font-bold">{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
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
        ) : viewMode === "profit-share" ? (
          <PartnerProfitShareView computed={computed.profitShare} formatValue={formatValue} filterBar={viewSwitcher} />
        ) : (
          <PartnerStatementView computed={computed.statement} formatValue={formatValue} filterBar={viewSwitcher} />
        )
      }
      sidePanel={
        showProfitDistribution ? (
          <ProfitDistributionSidePanel
            onClose={() => setShowProfitDistribution(false)}
          />
        ) : null
      }
      isPanelOpen={showProfitDistribution}
    />
  );
}
