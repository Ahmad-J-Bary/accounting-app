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
    <div className={cn("flex items-center gap-3 rounded-2xl border border-muted bg-white p-4 shadow-sm", className)}>
      {icon && (
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground", iconClassName)}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}
