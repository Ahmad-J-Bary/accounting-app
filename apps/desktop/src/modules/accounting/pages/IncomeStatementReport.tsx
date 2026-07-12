import { useCallback, useEffect, useMemo, useState } from "react";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Calendar, RefreshCw } from "lucide-react";
import { IncomeStatementView } from "@modules/accounting/components/income-statement/IncomeStatementView";
import {
  computeIncomeStatement,
  type IncomeStatementFilters,
} from "@modules/accounting/lib/incomeStatement";
import { useIncomeStatementReport } from "@modules/accounting/hooks/useIncomeStatementReport";
import { DateField } from "@widgets/form-shell/DateField";

export default function IncomeStatementReport() {
  const { baseCurrency, currencies, formatAmount } = useCurrencyContext();
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [filters, setFilters] = useState<IncomeStatementFilters>(() => {
    const now = new Date();
    return {
      from_date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
      to_date: now.toISOString().split("T")[0],
    };
  });
  const { loading, refreshing, lastLoadedAt, reportData, loadReportData } = useIncomeStatementReport();

  useEffect(() => {
    if (!selectedCurrency && baseCurrency?.code) {
      setSelectedCurrency(baseCurrency.code);
    }
  }, [baseCurrency, selectedCurrency]);

  const computed = useMemo(() => {
    return computeIncomeStatement(filters, reportData);
  }, [filters, reportData]);

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
    return activeCurrency ? `${activeCurrency.name} (${activeCurrency.symbol || activeCurrency.code})` : selectedCurrency || baseCurrency?.code || "—";
  }, [currencies, selectedCurrency, baseCurrency]);

  return (
    <ReportLayout
      title="قائمة الدخل"
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
          <IncomeStatementView
            computed={computed}
            filters={filters}
            selectedCurrencyLabel={selectedCurrencyLabel}
            lastLoadedAt={lastLoadedAt}
            formatValue={formatValue}
          />
        )}
      </div>
    </ReportLayout>
  );
}
