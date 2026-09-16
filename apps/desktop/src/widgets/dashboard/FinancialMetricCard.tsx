import { useCurrencyContext, type CurrencyDisplayMode } from "@app/providers/CurrencyContext";
import type { LucideIcon } from "lucide-react";

interface FinancialMetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  displayMode: CurrencyDisplayMode | "both";
}

export function FinancialMetricCard({
  label,
  value,
  icon: Icon,
  displayMode,
}: FinancialMetricCardProps) {
  const { formatAmount } = useCurrencyContext();

  return (
    <div className="p-4 rounded-2xl border border-muted bg-muted/50 flex flex-col justify-between">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-black text-foreground tabular-nums">
        {formatAmount(value, { mode: displayMode })}
      </div>
    </div>
  );
}
