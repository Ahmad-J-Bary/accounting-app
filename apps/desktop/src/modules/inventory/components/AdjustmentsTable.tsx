import { useMemo } from "react";
import { ArrowUpCircle, ArrowDownCircle, Minus } from "lucide-react";
import { cn } from '@shared/lib/utils';
import type { StockAdjustment } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useUnifiedColumns, useSortable } from "@shared/hooks";
import { formatDateTime, formatNumber, toFixed } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useBaseCurrencyColumns } from "@shared/hooks";

interface AdjustmentsTableProps {
  data: StockAdjustment[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  selectedId?: string | null;
  onView?: (item: StockAdjustment) => void;
  onEdit?: (item: StockAdjustment) => void;
  onDelete?: (id: string) => void;
  onRowClick?: (item: StockAdjustment) => void;
}

export function AdjustmentsTable({ data, loading, search, onSearchChange, selectedId, onView, onEdit, onDelete, onRowClick }: AdjustmentsTableProps) {
  const { currencies, formatAmount } = useCurrencyContext();
  const { isBaseCurrency, currencySuffix: cs } = useBaseCurrencyColumns();
  type SortField = "material_name" | "system_quantity" | "actual_quantity" | "difference" | "total_cost" | "adjustment_date" | "notes";

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data,
    defaultField: "adjustment_date" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "material_name": comparison = (a.material_name || "").localeCompare(b.material_name || "", "ar"); break;
        case "system_quantity": comparison = parseFloat(a.system_quantity) - parseFloat(b.system_quantity); break;
        case "actual_quantity": comparison = parseFloat(a.actual_quantity) - parseFloat(b.actual_quantity); break;
        case "difference": comparison = parseFloat(a.difference) - parseFloat(b.difference); break;
        case "total_cost": comparison = parseFloat(a.total_cost_base || "0") - parseFloat(b.total_cost_base || "0"); break;
        case "adjustment_date": comparison = new Date(a.adjustment_date).getTime() - new Date(b.adjustment_date).getTime(); break;
        case "notes": comparison = (a.notes || a.reason || "").localeCompare(b.notes || b.reason || "", "ar"); break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<StockAdjustment>[]>(() => {
    const cols: UnifiedColumn<StockAdjustment>[] = [
      {
        id: "id",
        header: "الرقم",
        label: "الرقم",
        accessor: (a, idx) => a.reference ? formatNumber(parseInt(a.reference) || 0) : (idx + 1).toString(),
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "material_name",
        header: "المادة",
        label: "المادة",
        accessor: (a) => a.material_name ?? a.material_id,
        className: "font-bold text-slate-800"
      },
      {
        id: "system_quantity",
        header: "كمية النظام",
        label: "كمية النظام",
        accessor: (a) => toFixed(parseFloat(a.system_quantity), 2),
        className: "tabular-nums text-slate-600"
      },
      {
        id: "actual_quantity",
        header: "الكمية المجرودة",
        label: "الكمية المجرودة",
        accessor: (a) => toFixed(parseFloat(a.actual_quantity), 2),
        className: "tabular-nums font-bold text-slate-800"
      },
      {
        id: "difference",
        header: "الفارق",
        label: "الفارق",
        accessor: (a) => {
          const diff = parseFloat(a.difference);
          return (
            <span className={cn(
              "inline-flex items-center gap-1.5 font-black tabular-nums",
              diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-slate-400"
            )}>
              {diff > 0 ? <ArrowUpCircle className="w-4 h-4" /> : diff < 0 ? <ArrowDownCircle className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              {diff > 0 ? "+" : ""}{toFixed(diff, 2)}
            </span>
          );
        },
      },
      ...currencies.map((curr) => {
        const symbol = curr.symbol || curr.code;
        return {
          id: `total_cost_${curr.code}`,
          header: `التكلفة ${cs(symbol)}`,
          label: `التكلفة ${cs(symbol)}`,
          accessor: (a: StockAdjustment) => {
            const cost = parseFloat(a.total_cost_base || "0");
            return Math.abs(cost) > 0 ? (
              <span className="tabular-nums font-black text-slate-900">{formatAmount(cost, { currencyCode: curr.code })}</span>
            ) : (
              <span className="text-slate-400">—</span>
            );
          },
          className: "tabular-nums",
        } as UnifiedColumn<StockAdjustment>;
      }),
      {
        id: "notes",
        header: "ملاحظة",
        label: "ملاحظة",
        accessor: (a) => a.notes ?? a.reason ?? "",
        className: "text-slate-500"
      },
      {
        id: "adjustment_date",
        header: "التاريخ",
        label: "تاريخ التسوية",
        accessor: (a) => formatDateTime(a.adjustment_date),
        className: "tabular-nums text-slate-500"
      },
    ];

    if (onView || onEdit || onDelete) {
      cols.push({
        id: "actions",
        header: "إجراءات",
        label: "إجراءات",
        accessor: (a) => (
          <TableActions
            onView={onView ? () => onView(a) : undefined}
            onEdit={onEdit ? () => onEdit(a) : undefined}
            onDelete={onDelete ? () => onDelete(a.id) : undefined}
          />
        ),
      });
    }

    return cols;
  }, [onView, onEdit, onDelete, formatAmount, currencies, cs]);

  const defaultVisible = useMemo(() => {
    const ids: string[] = ["id", "material_name", "system_quantity", "actual_quantity",
      "difference", "adjustment_date", "notes"];
    currencies.forEach((curr) => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`total_cost_${curr.code}`);
      }
    });
    if (onView || onEdit || onDelete) ids.push("actions");
    return ids;
  }, [onView, onEdit, onDelete, currencies, isBaseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "adjustments",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    return enrichedColumns.map(col => {
      const id = col.id;
      if (id === "material_name") {
        return { id: "count", columnId: id, label: "", value: `${sortedData.length} تسوية`, className: "text-slate-500 font-medium" };
      }
      if (id.startsWith("total_cost_")) {
        const total = sortedData.reduce((s, a) => s + parseFloat(a.total_cost_base || "0"), 0);
        const totalCostId = id;
        return {
          id: `cost_summary_${totalCostId}`, columnId: id, label: "الإجمالي",
          value: total !== 0 ? formatAmount(total, { currencyCode: id.replace("total_cost_", "") }) : "—",
          className: "text-slate-900 font-black"
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [sortedData, enrichedColumns, formatAmount]);

  const sortableFields: SortField[] = [
    "material_name", "system_quantity", "actual_quantity",
    "difference", "total_cost", "adjustment_date", "notes"
  ];

  const filtered = useMemo(() =>
    sortedData.filter(a =>
      (a.reference?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (a.material_name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (a.material_id?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (a.notes?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (a.reason?.toLowerCase() || "").includes(search.toLowerCase())
    ),
    [sortedData, search]
  );

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالمنتج أو الملاحظة..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
    >
      <UnifiedTable
        data={filtered}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="adjustments"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (sortableFields.includes(col.id as SortField)) {
            handleSort(col.id as SortField);
          } else if (col.id.startsWith("total_cost_")) {
            handleSort("total_cost" as SortField);
          }
        }}
        selectedId={selectedId}
        onRowClick={onRowClick}
        emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد تسويات مسجّلة"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}