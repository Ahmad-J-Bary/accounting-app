import { useCallback, useEffect, useMemo, useState } from "react";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Calendar, RefreshCw } from "lucide-react";
import { computeBalanceSheet } from "@modules/accounting/lib/balanceSheet";
import { useBalanceSheetReport } from "@modules/accounting/hooks/useBalanceSheetReport";
import { BalanceSheetView } from "@modules/accounting/components/balance-sheet/BalanceSheetView";

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</Label>
      <div className="relative">
        <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pr-10 font-bold tabular-nums"
        />
      </div>
    </div>
  );
}

export default function BalanceSheetReport() {
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
  const { loading, refreshing, lastLoadedAt, reportData, loadReportData } = useBalanceSheetReport(filters);

  useEffect(() => {
    if (!selectedCurrency && baseCurrency?.code) {
      setSelectedCurrency(baseCurrency.code);
    }
  }, [baseCurrency, selectedCurrency]);

  const computed = useMemo(() => {
    return computeBalanceSheet(reportData.accounts, {
      netProfit: reportData.netProfit,
      totalDrawings: reportData.totalDrawings,
    });
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
