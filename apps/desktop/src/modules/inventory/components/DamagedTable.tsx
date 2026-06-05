import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns } from "@shared/hooks";

import type { DamagedItem } from "@erp/shared-types";

interface DamagedTableProps {
  items: DamagedItem[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  selectedId?: string | null;
  onView?: (item: DamagedItem) => void;
  onEdit?: (item: DamagedItem) => void;
  onDelete?: (id: string) => void;
}

type SortField = "material_name" | "quantity" | "damage_date" | "cost_impact";

export function DamagedTable({
  items,
  loading,
  search,
  onSearchChange,
  selectedId,
  onView,
  onEdit,
  onDelete,
}: DamagedTableProps) {
  const { formatAmount, currencies } = useCurrencyContext();
  const { isBaseCurrency } = useBaseCurrencyColumns();

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
        accessor: (i) => i.material_name || i.material_id || "",
        className: "font-bold text-slate-800"
      },
      {
        id: "reason",
        header: "السبب",
        label: "سبب التلف",
        accessor: (i) => i.reason || "",
        className: "text-slate-500 italic"
      },
      {
        id: "quantity",
        header: "الكمية",
        label: "الكمية التالفة",
        accessor: (i) => Math.round(parseFloat(i.quantity || "0")).toString(),
        className: "tabular-nums font-black text-amber-600"
      },
    ];

    currencies.forEach(curr => {
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `cost_${curr.code}`,
        header: `الخسارة (${curr.symbol || curr.code})`,
        label: `مبلغ الخسارة (${curr.symbol || curr.code})`,
        accessor: (i) => {
          const val = parseFloat(i.cost_impact || "0");
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "";
        },
        className: isBase
          ? "tabular-nums font-black text-rose-600"
          : "tabular-nums font-medium text-rose-300"
      });
    });

    cols.push({
      id: "damage_date",
      header: "التاريخ",
      label: "تاريخ التسجيل",
      accessor: (i) => formatDateTime(i.damage_date),
      className: "text-slate-500 tabular-nums"
    });

    if (onView || onEdit || onDelete) {
      cols.push({
        id: "actions",
        header: "إجراءات",
        label: "إجراءات",
        accessor: (i) => (
          <TableActions
            onView={onView ? () => onView(i) : undefined}
            onEdit={onEdit ? () => onEdit(i) : undefined}
            onDelete={onDelete ? () => onDelete(i.id) : undefined}
          />
        ),
      });
    }

    return cols;
  }, [formatAmount, currencies, isBaseCurrency, onView, onEdit, onDelete]);

  // Default visible: only base currency's loss column is shown.
  const defaultVisible = useMemo(() => {
    const ids: string[] = ["material_name", "reason", "quantity"];
    currencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`cost_${curr.code}`);
      }
    });
    ids.push("damage_date");
    if (onView || onEdit || onDelete) ids.push("actions");
    return ids;
  }, [currencies, isBaseCurrency, onView, onEdit, onDelete]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "damaged-items-table",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalCost = sortedItems.reduce((s, i) => s + parseFloat(i.cost_impact || "0"), 0);

    return enrichedColumns.map(col => {
      if (col.id === 'material_name') {
        return {
          id: 'count',
          columnId: 'material_name',
          label: '',
          value: `${sortedItems.length} سجل`,
          className: 'text-slate-500 font-medium'
        };
      }
      if (col.id === 'quantity') {
        return { id: `${col.id}_spacer`, columnId: col.id, label: '', value: '' };
      }
      const match = col.id.match(/^cost_(.+)$/);
      if (match) {
        const currCode = match[1];
        const isBase = isBaseCurrency(currCode);
        const sym = currencies.find(c => c.code === currCode)?.symbol || currCode;
        return {
          id: `${col.id}_summary`,
          columnId: col.id,
          label: `إجمالي الخسارة (${sym})`,
          value: totalCost > 0 ? formatAmount(totalCost, { currencyCode: currCode }) : "—",
          className: isBase
            ? 'text-rose-600 font-black'
            : 'text-rose-300 font-extrabold'
        };
      }
      return { id: `${col.id}_spacer`, columnId: col.id, label: '', value: '' };
    });
  }, [sortedItems, enrichedColumns, formatAmount, isBaseCurrency, currencies]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالمنتج أو السبب..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
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
        selectedId={selectedId}
        onRowClick={onView}
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