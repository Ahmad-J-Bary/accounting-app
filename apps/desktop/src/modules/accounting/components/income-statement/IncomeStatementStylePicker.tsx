import { LayoutGrid, List, Table2, Rows3 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@shared/ui/toggle-group";
import { cn } from "@shared/lib/utils";
import type { IncomeStatementStyle } from "@modules/accounting/lib/incomeStatement";

const styleOptions: Array<{
  value: IncomeStatementStyle;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "ledger", label: "دفتر", icon: List },
  { value: "table", label: "جدول", icon: Table2 },
  { value: "cards", label: "بطاقات", icon: LayoutGrid },
  { value: "compact", label: "موجز", icon: Rows3 },
];

interface IncomeStatementStylePickerProps {
  value: IncomeStatementStyle;
  onValueChange: (style: IncomeStatementStyle) => void;
}

export function IncomeStatementStylePicker({
  value,
  onValueChange,
}: IncomeStatementStylePickerProps) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) {
            onValueChange(nextValue as IncomeStatementStyle);
          }
        }}
        variant="outline"
        size="sm"
        className="grid w-full grid-cols-2 gap-1 sm:flex sm:w-auto"
      >
        {styleOptions.map((option) => {
          const Icon = option.icon;
          return (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              aria-label={option.label}
              className={cn(
                "h-11 w-full rounded-xl border-0 px-3 text-slate-600 shadow-none data-[state=on]:bg-slate-900 data-[state=on]:text-white sm:w-auto",
              )}
            >
              <span className="flex items-center gap-2 text-xs font-black">
                <Icon className="h-4 w-4" />
                {option.label}
              </span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
