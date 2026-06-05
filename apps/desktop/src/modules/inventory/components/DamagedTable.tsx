import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable } from "@shared/hooks";

import type { DamagedItem } from "@erp/shared-types";

interface DamagedTableProps {
  items: DamagedItem[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
}

type SortField = "material_name" | "quantity" | "damage_date" | "cost_impact";

export function DamagedTable({ items, loading, search, onSearchChange }: DamagedTableProps) {
  const { formatAmount, currencies } = useCurrencyContext();

  const { sortedData: sortedItems, sortField, sortDirection, handleSort } = useSortable({
    data: items,
    defaultField: "damage_date" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
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
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<DamagedItem>[]>(() => {
    const cols: UnifiedColumn<DamagedItem>[] = [
      {
        id: "material_name",
        header: "المنتج / الصنف",
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
        header: "التاريخ",
        label: "تاريخ التسجيل",
        accessor: (i) => formatDateTime(i.damage_date),
        className: "tabular-nums text-slate-500 font-medium w-32"
      },
      {
        id: "quantity",
        header: "الكمية",
        label: "الكمية التالفة",
        accessor: (i) => (
          <span className="tabular-nums font-bold text-amber-600">{Math.round(parseFloat(i.quantity))}</span>
        ),
        className: "w-24"
      },
    ];

    // Multi-currency cost columns
    currencies.forEach(curr => {
      cols.push({
        id: `cost_${curr.code}`,
        header: `الخسارة (${curr.symbol || curr.code})`,
        label: `مبلغ الخسارة (${curr.symbol || curr.code})`,
        accessor: (i) => {
          const val = parseFloat(i.cost_impact || "0");
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "—";
        },
        className: "tabular-nums font-black text-rose-600 text-[11px]"
      });
    });

    return cols;
  }, [formatAmount, currencies]);

  // FIX: include dynamic cost columns in defaultVisible so they show on first load
  const defaultVisible = useMemo(() => [
    "material_name",
    "reason",
    "damage_date",
    "quantity",
    ...currencies.map(c => `cost_${c.code}`),
  ], [currencies]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "damaged-items-table",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalCost = sortedItems.reduce((s, i) => s + parseFloat(i.cost_impact || "0"), 0);
    const totalQty = sortedItems.reduce((s, i) => s + parseFloat(i.quantity || "0"), 0);

    // FIX: IDs must follow the pattern UnifiedTable expects:
    //   col.id === s.id  OR  `${col.id}_summary`  OR  `${col.id}_spacer`
    return enrichedColumns.map(col => {
      if (col.id === 'material_name') {
        return {
          id: 'material_name',        // matches col.id directly
          label: '',
          value: `${sortedItems.length} سجل`,
          className: 'text-slate-500 font-medium'
        };
      }
      if (col.id === 'quantity') {
        return {
          id: 'quantity_summary',     // matches `${col.id}_summary`
          label: '',
          value: Math.round(totalQty).toString(),
          className: 'text-amber-600 font-bold'
        };
      }
      const match = col.id.match(/^cost_(.+)$/);
      if (match) {
        const currCode = match[1];
        return {
          id: `${col.id}_summary`,    // matches `${col.id}_summary`
          label: '',
          value: totalCost > 0 ? formatAmount(totalCost, { currencyCode: currCode }) : "—",
          className: 'text-rose-600 font-bold'
        };
      }
      // spacer for all other columns (reason, damage_date, notes, etc.)
      return { id: `${col.id}_spacer`, label: '', value: '' };
    });
  }, [sortedItems, enrichedColumns, formatAmount]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالمنتج أو السبب..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={sortedItems}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="damaged"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (col.id === "material_name") handleSort("material_name");
          else if (col.id === "damage_date") handleSort("damage_date");
          else if (col.id === "quantity") handleSort("quantity");
          else if (col.id?.startsWith("cost_")) handleSort("cost_impact");
        }}
        summary={summaryColumns}
        emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد سجلات تالف"}
      />
    </TableShell>
  );
}