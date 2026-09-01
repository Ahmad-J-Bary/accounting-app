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
  symbol,
  showCurrency = false,
  currencies = [],
  placeholder = "0.00",
  disabled = false,
  step = "0.01",
  min = "0",
  inputClassName = "",
}: CurrencyFieldProps) {
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
        <FieldLabel>العملة</FieldLabel>
        <Select dir="rtl" value={currency} onValueChange={onCurrencyChange} disabled={disabled}>
          <SelectTrigger className="bg-white border-slate-200 h-9 w-full text-right text-xs">
            <SelectValue placeholder="اختر العملة" />
          </SelectTrigger>
          <SelectContent>
            {currencies
              .filter((c) => c.is_active)
              .map((c) => (
                <SelectItem key={c.code} value={c.code} className="text-xs">
                  {c.name_ar} ({c.code})
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
