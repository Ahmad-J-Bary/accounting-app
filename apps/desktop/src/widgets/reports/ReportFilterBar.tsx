import type { ReactNode } from "react";
import { useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { RefreshCw, Calendar, Download, Printer } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { cn } from "@shared/lib/utils";
import type { ReportFilters } from "@shared/types/report";

export interface ReportFilterBarProps {
  filters: ReportFilters;
  onFiltersChange: (filters: Partial<ReportFilters>) => void;
  onRefresh: () => void | Promise<void>;
  loading?: boolean;
  refreshing?: boolean;
  selectedCurrencyLabel?: string;
  lastLoadedAt?: Date | null;
  onExport?: () => void;
  onPrint?: () => void;
  showCurrencySelect?: boolean;
  showDateRange?: boolean;
  selectedCurrency?: string;
  onCurrencyChange?: (value: string) => void;
  currencies?: Array<{ code: string; symbol?: string; name_ar?: string; name?: string }>;
  baseCurrencyCode?: string;
  extraFilters?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function ReportFilterBar({
  filters,
  onFiltersChange,
  onRefresh,
  loading = false,
  refreshing = false,
  onExport,
  onPrint,
  showCurrencySelect = true,
  showDateRange = true,
  selectedCurrencyLabel,
  lastLoadedAt,
  selectedCurrency,
  onCurrencyChange,
  currencies = [],
  baseCurrencyCode,
  extraFilters,
  children,
  className,
}: ReportFilterBarProps) {
  const { baseCurrency } = useCurrencyContext();
  const currentCurrency = selectedCurrency ?? baseCurrencyCode ?? baseCurrency?.code ?? "";

  const currencyOptions = useMemo(() => {
    if (!showCurrencySelect) return [];
    const options = currencies.map((currency) => ({
      code: currency.code,
      label: `${currency.code}${currency.symbol ? ` (${currency.symbol})` : ""}${currency.name_ar ? ` - ${currency.name_ar}` : currency.name ? ` - ${currency.name}` : ""}`,
    }));

    const fallbackBase = baseCurrencyCode || baseCurrency?.code;
    if (fallbackBase && !options.some((option) => option.code === fallbackBase)) {
      options.unshift({
        code: fallbackBase,
        label: `العملة الأساسية (${fallbackBase})`,
      });
    }

    return options;
  }, [currencies, baseCurrencyCode, baseCurrency, showCurrencySelect]);

  return (
    <div className={cn("col-span-full space-y-4", className)}>
      {(selectedCurrencyLabel || lastLoadedAt) && (
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          {selectedCurrencyLabel && (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              العملة: {selectedCurrencyLabel}
            </span>
          )}
          {lastLoadedAt && (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              آخر تحديث: {lastLoadedAt.toLocaleString("ar")}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {showDateRange && (
          <>
            <div className="space-y-2 min-w-[180px]">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">من تاريخ</Label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="date"
                  value={filters.from_date}
                  onChange={(e) => onFiltersChange({ from_date: e.target.value })}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pr-10 font-bold tabular-nums"
                />
              </div>
            </div>
            <div className="space-y-2 min-w-[180px]">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">إلى تاريخ</Label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="date"
                  value={filters.to_date}
                  onChange={(e) => onFiltersChange({ to_date: e.target.value })}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pr-10 font-bold tabular-nums"
                />
              </div>
            </div>
          </>
        )}

        {showCurrencySelect && (
          <div className="space-y-2 min-w-[180px]">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">العملة</Label>
            <Select
              value={currentCurrency}
              onValueChange={onCurrencyChange}
              disabled={!currencyOptions.length}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50">
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
          </div>
        )}

        {extraFilters}

        <div className="flex items-end gap-2 ml-auto">
          {onPrint && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
              className="gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Printer className="w-4 h-4" /> طباعة
            </Button>
          )}
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-4 h-4" /> تصدير
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading || refreshing}
            className="gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            تحديث
          </Button>
        </div>
      </div>

      {children && <div className="pt-4 border-t border-slate-200">{children}</div>}
    </div>
  );
}
