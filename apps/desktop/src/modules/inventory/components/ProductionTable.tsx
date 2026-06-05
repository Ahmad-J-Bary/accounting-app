import { useMemo } from "react";
import { formatDateTime, formatCurrency } from '@shared/lib/format';
import { cn } from "@shared/lib/utils";
import type { ProductionOrder } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useUnifiedColumns, useSortable } from '@shared/hooks';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  Draft: { label: "مسودة", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  InProgress: { label: "جاري التنفيذ", cls: "bg-blue-50 text-blue-700 ring-blue-100" },
  Completed: { label: "مكتمل", cls: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  Cancelled: { label: "ملغي", cls: "bg-rose-50 text-rose-700 ring-rose-100" },
};

interface ProductionTableProps {
  data: ProductionOrder[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
}

export function ProductionTable({ data, loading, search, onSearchChange }: ProductionTableProps) {
  const allColumns = useMemo<UnifiedColumn<ProductionOrder>[]>(() => [
    {
      id: "order_number",
      header: "رقم الأمر",
      label: "رقم أمر الإنتاج",
      accessor: "order_number",
      className: "font-black text-blue-600 font-mono w-28"
    },
    {
      id: "production_date",
      header: "التاريخ",
      label: "تاريخ الإنتاج",
      accessor: (o) => formatDateTime(o.production_date),
      className: "tabular-nums text-slate-500 font-medium w-32"
    },
    {
      id: "materials_count",
      header: "المواد الخام",
      label: "عدد المواد الخام المستخدمة",
      accessor: (o) => (
        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold text-xs">
          {o.materials.length} أصناف
        </span>
      ),
      className: "w-32"
    },
    {
      id: "outputs_count",
      header: "المنتجات التامة",
      label: "عدد المنتجات التامة الناتجة",
      accessor: (o) => (
        <span className="inline-flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded text-blue-600 font-bold text-xs">
          {o.outputs.length} منتجات
        </span>
      ),
      className: "w-32"
    },
    {
      id: "total_cost",
      header: "إجمالي التكلفة",
      label: "إجمالي تكلفة الإنتاج",
      accessor: (o) => formatCurrency(parseFloat(o.total_cost)),
      className: "tabular-nums font-black text-slate-900 w-32"
    },
    {
      id: "status",
      header: "الحالة",
      label: "حالة الأمر",
      accessor: (o) => {
        const st = STATUS_MAP[o.status] ?? { label: o.status, cls: "bg-slate-100 text-slate-700 ring-slate-200" };
        return (
          <span className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ring-1 ring-inset",
            st.cls
          )}>
            {st.label}
          </span>
        );
      },
      className: "w-28"
    }
  ], []);

  type SortField = "order_number" | "production_date" | "materials_count" | "outputs_count" | "total_cost" | "status";

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "production-orders-unified",
    columns: allColumns,
    defaultVisible: allColumns.map(c => c.id),
  });

  const filtered = useMemo(() =>
    data.filter(o =>
      o.order_number.toLowerCase().includes(search.toLowerCase())
    ),
    [data, search]
  );

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data: filtered,
    defaultField: "production_date" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "order_number":
          comparison = (a.order_number || "").localeCompare(b.order_number || "", "ar", { numeric: true });
          break;
        case "production_date":
          comparison = new Date(a.production_date).getTime() - new Date(b.production_date).getTime();
          break;
        case "materials_count":
          comparison = a.materials.length - b.materials.length;
          break;
        case "outputs_count":
          comparison = a.outputs.length - b.outputs.length;
          break;
        case "total_cost":
          comparison = parseFloat(a.total_cost) - parseFloat(b.total_cost);
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "", "ar");
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث برقم الأمر..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="production"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          const sortableFields: SortField[] = ["order_number", "production_date", "materials_count", "outputs_count", "total_cost", "status"];
          if (sortableFields.includes(col.id as SortField)) {
            handleSort(col.id as SortField);
          }
        }}
        emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد أوامر إنتاج مسجّلة"}
      />
    </TableShell>
  );
}
