import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Calendar, RefreshCw, Users, BookOpen } from "lucide-react";
import { computePartnerProfitShare } from "@modules/accounting/lib/partnerProfitShare";
import { usePartnerProfitShareReport } from "@modules/accounting/hooks/usePartnerProfitShareReport";
import { PartnerProfitShareView } from "@modules/accounting/components/partner-profit-share/PartnerProfitShareView";
import { DateField } from "@widgets/form-shell/DateField";

export default function PartnerProfitShareReport() {
  const navigate = useNavigate();
  const { baseCurrency, currencies, formatAmount } = useCurrencyContext();
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return {
      from_date: startOfYear.toISOString().split("T")[0],
      to_date: now.toISOString().split("T")[0],
    };
  });
  const { loading, refreshing, lastLoadedAt, reportData, loadReportData } = usePartnerProfitShareReport(filters);

  useEffect(() => {
    if (!selectedCurrency && baseCurrency?.code) {
      setSelectedCurrency(baseCurrency.code);
    }
  }, [baseCurrency, selectedCurrency]);

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
      title="الشركاء وتقاسم الأرباح"
      filters={
        <>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">العملة</Label>
            <Select
              value={selectedCurrency || baseCurrency?.code || ""}
              onValueChange={setSelectedCurrency}
              disabled={!currencies.length}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50 font-bold">
                <SelectValue placeholder="اختر العملة..." />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.name} ({currency.symbol || currency.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DateField
            label="من تاريخ"
            value={filters.from_date}
            onChange={(value) => setFilters((current) => ({ ...current, from_date: value }))}
          />

          <DateField
            label="إلى تاريخ"
            value={filters.to_date}
            onChange={(value) => setFilters((current) => ({ ...current, to_date: value }))}
          />

          <div className="flex items-end gap-2">
            <Button
              className="h-11 rounded-xl bg-slate-900 font-black text-white flex-1"
              onClick={loadReportData}
              disabled={loading || refreshing}
            >
              <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              تحديث البيانات
            </Button>
            <Button
              className="h-11 rounded-xl bg-white font-black text-slate-700 border border-slate-200 hover:bg-slate-50 flex-1"
              onClick={() => navigate("/accounting/reports/partner-statement")}
            >
              <BookOpen className="ml-2 h-4 w-4" />
              كشف حساب تفصيلي
            </Button>
          </div>
        </>
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
