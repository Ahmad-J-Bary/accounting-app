import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";

interface StatsCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  iconClassName?: string;
  className?: string;
}

export function StatsCard({ label, value, icon, iconClassName, className }: StatsCardProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      {icon && (
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500", iconClassName)}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="truncate text-lg font-bold tabular-nums text-slate-900">{value}</p>
      </div>
    </div>
  );
}
