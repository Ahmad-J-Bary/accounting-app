import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";

export interface MoneyColumnGroup {
  id: string;
  total: number;
  label?: string;
  className?: string;
  valueFormatter: (amount: number) => string;
}

export interface BuildMoneySummaryOptions<T> {
  enrichedColumns: UnifiedColumn<T>[];
  primaryKeyColumnId: string;
  count: number;
  countLabel: string;
  countClassName?: string;
  moneyColumns: MoneyColumnGroup[];
  spacerColumnIds?: string[];
}

export function buildMoneySummaryColumns<T>({
  enrichedColumns,
  primaryKeyColumnId,
  count,
  countLabel,
  countClassName = "text-slate-500 font-medium",
  moneyColumns,
  spacerColumnIds = [],
}: BuildMoneySummaryOptions<T>): SummaryColumn[] {
  const moneyMap = new Map<string, MoneyColumnGroup>();
  for (const mc of moneyColumns) {
    moneyMap.set(mc.id, mc);
  }
  const spacerSet = new Set(spacerColumnIds);

  return enrichedColumns.map((col) => {
    if (col.id === primaryKeyColumnId) {
      return {
        id: "count",
        columnId: col.id,
        label: "",
        value: `${count} ${countLabel}`,
        className: countClassName,
      };
    }

    const money = moneyMap.get(col.id);
    if (money) {
      const hasValue = money.total !== 0;
      return {
        id: `${col.id}_summary`,
        columnId: col.id,
        label: money.label ?? "إجمالي",
        value: hasValue ? money.valueFormatter(money.total) : "—",
        className: money.className ?? "font-black text-slate-900",
      };
    }

    if (spacerSet.has(col.id)) {
      return { id: `${col.id}_spacer`, columnId: col.id, label: "", value: "" };
    }

    return { id: `${col.id}_spacer`, columnId: col.id, label: "", value: "" };
  });
}
