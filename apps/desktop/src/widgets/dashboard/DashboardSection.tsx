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
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-8 py-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">{title}</h2>
            <p className="text-xs font-medium text-slate-400">{subtitle}</p>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">
            {formatAmount(total, { mode: displayMode })}
          </div>
        </div>
      </div>
      <div className={`grid ${cols} gap-4 p-6 flex-1`}>{children}</div>
    </div>
  );
}
