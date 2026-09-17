import { Input } from "@shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import type { Currency } from "@erp/shared-types";
import { useLocalization } from "@app/providers/LocalizationProvider";

export interface CurrencyFieldProps {
  label: string;
  required?: boolean;
  currency: string;
  onCurrencyChange: (code: string) => void;
  amount: string | number;
  onAmountChange: (val: string) => void;
  symbol?: string;
  showCurrency?: boolean;
  currencies?: Currency[];
  placeholder?: string;
  disabled?: boolean;
  step?: string;
  min?: string;
  inputClassName?: string;
}

export function CurrencyField({
  label,
  required,
  currency,
  onCurrencyChange,
  amount,
  onAmountChange,
  showCurrency = false,
  currencies = [],
  placeholder = "0.00",
  disabled = false,
  step = "0.01",
  min = "0",
  inputClassName = "",
}: CurrencyFieldProps) {
  const { t, direction, language } = useLocalization();
  const amountInput = (
    <Input
      type="number"
      value={amount}
      onChange={(e) => onAmountChange(e.target.value)}
      placeholder={placeholder}
      step={step}
      min={min}
      disabled={disabled}
      className={`bg-white border-slate-200 h-9 text-xs tabular-nums ${inputClassName}`}
    />
  );

  if (!showCurrency) {
    return (
      <div className="space-y-1.5">
        <FieldLabel required={required}>{label}</FieldLabel>
        {amountInput}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <FieldLabel>{t("currencies.currencyField", { namespace: "settings" })}</FieldLabel>
        <Select dir={direction} value={currency} onValueChange={onCurrencyChange} disabled={disabled}>
          <SelectTrigger className="h-9 w-full bg-white text-start text-xs border-slate-200">
            <SelectValue placeholder={t("currencies.selectCurrency", { namespace: "settings" })} />
          </SelectTrigger>
          <SelectContent>
            {currencies
              .filter((c) => c.is_active)
              .map((c) => (
                <SelectItem key={c.code} value={c.code} className="text-xs">
                  {(language === "ar" ? c.name_ar : c.name_en) || c.name_ar} ({c.code})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <FieldLabel required={required}>{label}</FieldLabel>
        {amountInput}
      </div>
    </div>
  );
}
