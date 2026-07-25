import type { ReactNode } from "react";
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { DatePicker } from "@shared/ui/date-picker";
import type { ReportFilters } from "@shared/types/report";

type Currency = { code: string; symbol?: string; name_ar?: string; name?: string };

export interface ReportFilterBarProps {
  filters: ReportFilters;
  onFiltersChange: (filters: Partial<ReportFilters>) => void;
  showCurrencySelect?: boolean;
  selectedCurrency?: string;
  onCurrencyChange?: (value: string) => void;
  currencies?: Currency[];
  baseCurrencyCode?: string;
  extraFilters?: ReactNode;
}

function formatCurrencyLabel(c: Currency): string {
  const parts = [c.code];
  if (c.symbol) parts.push(`(${c.symbol})`);
  const displayName = c.name_ar || c.name || "";
  if (displayName) parts.push(`- ${displayName}`);
  return parts.join(" ");
}

export function ReportFilterBar({
  filters,
  onFiltersChange,
  showCurrencySelect = true,
  selectedCurrency,
  onCurrencyChange,
  currencies = [],
  baseCurrencyCode,
  extraFilters,
}: ReportFilterBarProps) {
  const { baseCurrency } = useCurrencyContext();

  const baseCode = useMemo(
    () => baseCurrencyCode || baseCurrency?.code || "",
    [baseCurrencyCode, baseCurrency?.code],
  );

  const currentCurrency = useMemo(
    () => selectedCurrency ?? baseCode,
    [selectedCurrency, baseCode],
  );

  const currencyOptions = useMemo(() => {
    if (!showCurrencySelect) return [];
    const options = currencies.map((c) => ({
      code: c.code,
      label: formatCurrencyLabel(c),
    }));

    const fallbackBase = baseCurrencyCode || baseCurrency?.code;
    if (fallbackBase && !options.find((o) => o.code === fallbackBase)) {
      options.unshift({
        code: fallbackBase,
        label: `العملة الأساسية (${fallbackBase})`,
      });
    }

    return options;
  }, [currencies, baseCurrencyCode, baseCurrency, showCurrencySelect]);

  const effectiveValue = useMemo(() => {
    if (!currentCurrency) return "";
    const match = currencyOptions.find((o) => o.code === currentCurrency);
    if (match) return currentCurrency;
    return currencyOptions[0]?.code || "";
  }, [currentCurrency, currencyOptions]);

  const showSelect = showCurrencySelect && !!onCurrencyChange && currencyOptions.length > 1;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showSelect && (
        <Select value={effectiveValue} onValueChange={onCurrencyChange}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-lg border-slate-200 bg-white text-xs">
            <SelectValue placeholder="اختر العملة" />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions.map((opt) => (
              <SelectItem key={opt.code} value={opt.code}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {extraFilters}

      <div className="flex items-center gap-2 mr-auto">
        <DatePicker
          value={filters.from_date}
          onChange={(v) => onFiltersChange({ from_date: v })}
          className="h-9 w-36 text-xs rounded-lg bg-white"
        />
        <span className="text-xs text-slate-400 font-bold">إلى</span>
        <DatePicker
          value={filters.to_date}
          onChange={(v) => onFiltersChange({ to_date: v })}
          className="h-9 w-36 text-xs rounded-lg bg-white"
        />
      </div>
    </div>
  );
}
