import React from "react";
import { useCurrencyContext, type CurrencyDisplayMode } from "@app/providers/CurrencyContext";

interface DashboardSectionProps {
  title: string;
  total: number;
  subtitle: string;
  displayMode: CurrencyDisplayMode | "both";
  children: React.ReactNode;
}

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

export function DashboardSection({
  title,
  total,
  subtitle,
  displayMode,
  children,
}: DashboardSectionProps) {
  const { formatAmount } = useCurrencyContext();
  const items = React.Children.toArray(children).filter(React.isValidElement);
  const cols = GRID_COLS[Math.min(items.length, 3)] || "grid-cols-3";

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4 lg:px-6 lg:py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground">{title}</h2>
            <p className="text-xs font-medium text-muted-foreground">{subtitle}</p>
          </div>
          <div className="text-2xl font-black tabular-nums text-foreground">
            {formatAmount(total, { mode: displayMode })}
          </div>
        </div>
      </div>
      <div className={`grid flex-1 ${cols} gap-3 p-4 sm:p-5`}>{children}</div>
    </div>
  );
}
