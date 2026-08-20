import type { ReactNode } from "react";
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Button } from "@shared/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { DateRangePicker } from "@widgets/reports";
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
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
  lastLoadedAt?: Date | null;
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
  refreshing = false,
  onRefresh,
  lastLoadedAt,
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
      {extraFilters}
      
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

      <DateRangePicker
        from={filters.from_date}
        to={filters.to_date}
        onFromChange={(v) => onFiltersChange({ from_date: v })}
        onToChange={(v) => onFiltersChange({ to_date: v })}
        showSeparator={showSelect || !!extraFilters}
      />

      {onRefresh && !refreshing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-lg border-slate-200 bg-white text-xs text-slate-600"
          onClick={() => void onRefresh()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          تحديث
        </Button>
      )}
      {refreshing && (
        <span className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          جارٍ التحديث…
        </span>
      )}
      {lastLoadedAt && !refreshing && (
        <span className="text-xs text-slate-400">
          آخر تحديث:{" "}
          {lastLoadedAt.toLocaleTimeString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}
