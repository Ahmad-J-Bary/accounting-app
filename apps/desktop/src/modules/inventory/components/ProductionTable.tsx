import { useMemo } from "react";
import { formatDateTime, formatCurrency } from '@shared/lib/format';
import { cn } from "@shared/lib/utils";
import type { ProductionOrder } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useUnifiedColumns } from '@shared/hooks';

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
      align: "center",
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
      align: "center",
      className: "w-32"
    },
    {
      id: "total_cost",
      header: "إجمالي التكلفة",
      label: "إجمالي تكلفة الإنتاج",
      accessor: (o) => formatCurrency(parseFloat(o.total_cost)),
      align: "left",
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
      align: "center",
      className: "w-28"
    }
  ], []);

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

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث برقم الأمر..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable
        data={filtered}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="production"
        emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد أوامر إنتاج مسجّلة"}
      />
    </TableShell>
  );
}
