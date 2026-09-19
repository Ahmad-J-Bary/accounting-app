import type { ReactNode } from "react";
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { DateRangePicker } from "./DateRangePicker";
import type { ReportFilters } from "@shared/types/report";
import { useLocalization } from "@app/providers/LocalizationProvider";

type Currency = { code: string; symbol?: string; name_ar?: string; name_en?: string; name?: string };

interface ReportPageContextProps {
  filters: ReportFilters;
  onFiltersChange: (filters: Partial<ReportFilters>) => void;
  showCurrencySelect?: boolean;
  selectedCurrency?: string;
  onCurrencyChange?: (value: string) => void;
  currencies?: Currency[];
  baseCurrencyCode?: string;
  extraContext?: ReactNode;
}

function formatCurrencyLabel(c: Currency, language: "ar" | "en"): string {
  const parts = [c.code];
  if (c.symbol) parts.push(`(${c.symbol})`);
  const displayName = language === "ar"
    ? c.name_ar || c.name_en || c.name || ""
    : c.name_en || c.name_ar || c.name || "";
  if (displayName) parts.push(`- ${displayName}`);
  return parts.join(" ");
}

export function ReportPageContext({
  filters,
  onFiltersChange,
  showCurrencySelect = false,
  selectedCurrency,
  onCurrencyChange,
  currencies = [],
  baseCurrencyCode,
  extraContext,
}: ReportPageContextProps) {
  const { t, language } = useLocalization();

  const currencyOptions = useMemo(() => {
    if (!showCurrencySelect) return [];
    const options = currencies.map((c) => ({
      code: c.code,
      label: formatCurrencyLabel(c, language),
    }));

    if (baseCurrencyCode && !options.find((o) => o.code === baseCurrencyCode)) {
      options.unshift({
        code: baseCurrencyCode,
        label: `${t("labels.baseCurrencyLabel")} (${baseCurrencyCode})`,
      });
    }

    return options;
  }, [baseCurrencyCode, currencies, language, showCurrencySelect, t]);

  const effectiveValue = useMemo(() => {
    if (!selectedCurrency) return currencyOptions[0]?.code || "";
    return currencyOptions.find((option) => option.code === selectedCurrency)
      ? selectedCurrency
      : currencyOptions[0]?.code || "";
  }, [currencyOptions, selectedCurrency]);

  const showSelect = showCurrencySelect && !!onCurrencyChange && currencyOptions.length > 0;

  return (
    <div className="flex items-center gap-2">
      {extraContext}
      {showSelect && (
        <Select value={effectiveValue} onValueChange={onCurrencyChange}>
          <SelectTrigger className="h-9 w-auto min-w-[140px] rounded-lg border-border bg-card text-xs font-bold">
            <SelectValue placeholder={t("labels.chooseCurrency")} />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <DateRangePicker
        from={filters.from_date}
        to={filters.to_date}
        onFromChange={(value) => onFiltersChange({ from_date: value })}
        onToChange={(value) => onFiltersChange({ to_date: value })}
        showSeparator={showSelect || !!extraContext}
      />
    </div>
  );
}
