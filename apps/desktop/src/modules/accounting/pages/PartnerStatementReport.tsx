import { useCallback, useEffect, useMemo, useState } from "react";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Calendar, RefreshCw, Users } from "lucide-react";
import { computePartnerProfitShare } from "@modules/accounting/lib/partnerProfitShare";
import { computePartnerStatement } from "@modules/accounting/lib/partnerStatement";
import { usePartnerProfitShareReport } from "@modules/accounting/hooks/usePartnerProfitShareReport";
import { PartnerStatementView } from "@modules/accounting/components/partner-statement/PartnerStatementView";
import { DateField } from "@widgets/form-shell/DateField";

export default function PartnerStatementReport() {
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

  return (
    <ReportLayout
      title="كشف حساب الشريك"
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

          <div className="flex items-end">
            <Button
              className="h-11 w-full rounded-xl bg-slate-900 font-black text-white"
              onClick={loadReportData}
              disabled={loading || refreshing}
            >
              <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              تحديث البيانات
            </Button>
          </div>
        </>
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
