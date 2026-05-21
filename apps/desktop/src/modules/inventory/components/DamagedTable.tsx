import { useMemo, useState, useCallback } from "react";
import { ArrowUpDown, AlertTriangle, PackageOpen, Banknote } from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext, formatWithLocale } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import type { DamagedItem } from "@erp/shared-types";

interface DamagedTableProps {
  items: DamagedItem[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
}

type SortField = "material_name" | "quantity" | "damage_date" | "cost_impact";

interface SortableHeaderProps {
  field: SortField;
  label: string;
  currentField: SortField;
  direction: "asc" | "desc";
  onSort: (field: SortField) => void;
}

const SortableHeader = ({ field, label, currentField, direction, onSort }: SortableHeaderProps) => {
  const getSortIcon = (f: SortField) => {
    if (currentField !== f) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return direction === "asc"
      ? <ArrowUpDown className="w-3 h-3 rotate-180" />
      : <ArrowUpDown className="w-3 h-3" />;
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSort(field); }}
      className="flex items-center gap-1 hover:text-slate-900 transition-colors"
    >
      {label}
      {getSortIcon(field)}
    </button>
  );
};

export function DamagedTable({ items, loading, search, onSearchChange }: DamagedTableProps) {
  const { formatAmount, currencies } = useCurrencyContext();
  const [sortField, setSortField] = useState<SortField>("damage_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = useCallback((field: SortField) => {
    setSortDirection(prev => {
      if (sortField === field) return prev === "asc" ? "desc" : "asc";
      return "asc";
    });
    setSortField(field);
  }, [sortField]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "material_name":
          comparison = (a.material_name || a.material_id || "").localeCompare(b.material_name || b.material_id || "", "ar");
          break;
        case "quantity":
          comparison = parseFloat(a.quantity) - parseFloat(b.quantity);
          break;
        case "damage_date":
          comparison = new Date(a.damage_date).getTime() - new Date(b.damage_date).getTime();
          break;
        case "cost_impact":
          comparison = parseFloat(a.cost_impact || "0") - parseFloat(b.cost_impact || "0");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [items, sortField, sortDirection]);

  const allColumns = useMemo<UnifiedColumn<DamagedItem>[]>(() => {
    const cols: UnifiedColumn<DamagedItem>[] = [
      {
        id: "material_name",
        header: <SortableHeader field="material_name" label="المنتج / الصنف" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: "اسم المنتج",
        accessor: (i) => (
          <span className="font-bold text-slate-900">{i.material_name ?? i.material_id}</span>
        ),
        className: "min-w-[180px]"
      },
      {
        id: "reason",
        header: "السبب",
        label: "سبب التلف",
        accessor: (i) => (
          <span className="text-slate-500 text-xs font-medium italic">{i.reason || "—"}</span>
        ),
        className: "min-w-[150px]"
      },
      {
        id: "damage_date",
        header: <SortableHeader field="damage_date" label="التاريخ" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: "تاريخ التسجيل",
        accessor: (i) => formatDateTime(i.damage_date),
        className: "tabular-nums text-slate-500 font-medium w-32"
      },
      {
        id: "quantity",
        header: <SortableHeader field="quantity" label="الكمية" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: "الكمية التالفة",
        accessor: (i) => (
          <span className="tabular-nums font-bold text-amber-600">{parseFloat(i.quantity).toFixed(2)}</span>
        ),
        align: "left",
        className: "w-24"
      },
    ];

    // Multi-currency cost columns
    currencies.forEach(curr => {
      cols.push({
        id: `cost_${curr.code}`,
        header: <SortableHeader field="cost_impact" label={`الخسارة (${curr.symbol || curr.code})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: `مبلغ الخسارة (${curr.symbol || curr.code})`,
        accessor: (i) => {
          const val = parseFloat(i.cost_impact || "0");
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "tabular-nums font-black text-rose-600 text-[11px]"
      });
    });

    return cols;
  }, [formatAmount, currencies, sortField, sortDirection, handleSort]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "damaged-items-table",
    columns: allColumns,
    defaultVisible: ["material_name", "damage_date", "quantity"],
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalCost = sortedItems.reduce((s, i) => s + parseFloat(i.cost_impact || "0"), 0);
    const totalQty = sortedItems.reduce((s, i) => s + parseFloat(i.quantity || "0"), 0);

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'material_name') return { id: 'count', label: '', value: `${sortedItems.length} سجل`, className: 'text-slate-500 font-medium' };
      if (id === 'quantity') return { id: 'qty_summary', label: '', value: totalQty.toFixed(2), align: 'left' as const, className: 'text-amber-600 font-bold' };
      const match = id.match(/^cost_(.+)$/);
      if (match) {
        const currCode = match[1];
        return {
          id: `${id}_summary`,
          label: '',
          value: totalCost > 0 ? formatAmount(totalCost, { currencyCode: currCode }) : "—",
          align: 'left' as const,
          className: 'text-rose-600 font-bold'
        };
      }
      return { id: `${id}_spacer`, label: '', value: '' };
    });
  }, [sortedItems, enrichedColumns, formatAmount]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالمنتج أو السبب..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable
        data={sortedItems}
        columns={enrichedColumns}
        loading={loading}
        summary={summaryColumns}
        emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد سجلات تالف"}
      />
    </TableShell>
  );
}