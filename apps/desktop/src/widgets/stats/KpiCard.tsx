import { cn } from '@shared/lib/utils';
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";
import { formatCurrency, formatNumber } from '@shared/lib/format';

interface KpiCardProps {
  title: string;
  value: number;
  change?: number;
  icon?: LucideIcon;
  iconColor?: string;
  currency?: boolean;
  suffix?: string;
}

export function KpiCard({ title, value, change, icon: Icon, iconColor = "bg-blue-50 text-blue-600", currency = true, suffix }: KpiCardProps) {
  const positive = change !== undefined && change >= 0;
  return (
    <div className="erp-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="text-sm text-muted-foreground">{title}</div>
        {Icon && (
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">
        {currency ? formatCurrency(value) : formatNumber(value) + (suffix ? ` ${suffix}` : "")}
      </div>
      {change !== undefined && (
        <div className={cn("flex items-center gap-1 mt-2 text-xs", positive ? "text-green-600" : "text-red-600")}>
          {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span className="font-medium tabular-nums">{Math.abs(change)}%</span>
          <span className="text-muted-foreground">مقارنة بالشهر الماضي</span>
        </div>
      )}
    </div>
  );
}