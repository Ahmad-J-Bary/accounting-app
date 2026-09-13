import { useMemo } from "react";
import { formatDateTime, formatCurrency } from '@shared/lib/format';
import { StatusBadge } from "@shared/ui/status-badge";
import type { ProductionOrder } from "@erp/shared-types";
import { SharedTable } from '@widgets/table-shell/SharedTable';
import type { UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { useLocalization } from "@app/providers/LocalizationProvider";

interface ProductionTableProps {
  data: ProductionOrder[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onVisibleColumnsChange?: (ids: string[]) => void;
}

export function ProductionTable({ data, loading, search, onSearchChange, onVisibleColumnsChange }: ProductionTableProps) {
  const { t } = useLocalization();
  const allColumns = useMemo<UnifiedColumn<ProductionOrder>[]>(() => [
    {
      id: "order_number",
      header: t("production.orderNumber", { namespace: "inventory", fallback: "رقم الأمر" }),
      label: t("production.orderNumberLabel", { namespace: "inventory", fallback: "رقم أمر الإنتاج" }),
      accessor: "order_number",
      className: "font-black text-blue-600 font-mono"
    },
    {
      id: "production_date",
      header: t("production.date", { namespace: "inventory", fallback: "التاريخ" }),
      label: t("production.dateLabel", { namespace: "inventory", fallback: "تاريخ الإنتاج" }),
      accessor: (o) => formatDateTime(o.production_date),
      className: "tabular-nums text-slate-500"
    },
    {
      id: "materials_count",
      header: t("production.rawMaterials", { namespace: "inventory", fallback: "المواد الخام" }),
      label: t("production.rawMaterialsLabel", { namespace: "inventory", fallback: "عدد المواد الخام المستخدمة" }),
      accessor: (o) => (
        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold text-xs">
          {o.materials.length} أصناف
        </span>
      ),
    },
    {
      id: "outputs_count",
      header: t("production.finishedProducts", { namespace: "inventory", fallback: "المنتجات التامة" }),
      label: t("production.finishedProductsLabel", { namespace: "inventory", fallback: "عدد المنتجات التامة الناتجة" }),
      accessor: (o) => (
        <span className="inline-flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded text-blue-600 font-bold text-xs">
          {o.outputs.length} منتجات
        </span>
      ),
    },
    {
      id: "total_cost",
      header: t("production.totalCost", { namespace: "inventory", fallback: "إجمالي التكلفة" }),
      label: t("production.totalCostLabel", { namespace: "inventory", fallback: "إجمالي تكلفة الإنتاج" }),
      accessor: (o) => formatCurrency(parseFloat(o.total_cost)),
      className: "tabular-nums font-black text-slate-900"
    },
    {
      id: "status",
      header: t("production.status", { namespace: "inventory", fallback: "الحالة" }),
      label: t("production.statusLabel", { namespace: "inventory", fallback: "حالة الأمر" }),
      accessor: (o) => <StatusBadge status={o.status} />,
    }
  ], [t]);

  const filtered = useMemo(() =>
    data.filter(o =>
      o.order_number.toLowerCase().includes(search.toLowerCase())
    ),
    [data, search]
  );

  const sortFn = (a: ProductionOrder, b: ProductionOrder, field: string, direction: 'asc' | 'desc') => {
    let comparison = 0;
    switch (field) {
      case "order_number": comparison = (a.order_number || "").localeCompare(b.order_number || "", "ar", { numeric: true }); break;
      case "production_date": comparison = new Date(a.production_date).getTime() - new Date(b.production_date).getTime(); break;
      case "materials_count": comparison = a.materials.length - b.materials.length; break;
      case "outputs_count": comparison = a.outputs.length - b.outputs.length; break;
      case "total_cost": comparison = parseFloat(a.total_cost) - parseFloat(b.total_cost); break;
      case "status": comparison = (a.status || "").localeCompare(b.status || "", "ar"); break;
    }
    return direction === "asc" ? comparison : -comparison;
  };

  return (
    <SharedTable
      data={filtered}
      columns={allColumns}
      defaultVisible={allColumns.map(c => c.id)}
      loading={loading}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث برقم الأمر..."
      tableId="production"
      sortConfig={{ field: "production_date", direction: "desc", sortFn }}
      sortableFields={["order_number", "production_date", "materials_count", "outputs_count", "total_cost", "status"]}
      emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد أوامر إنتاج مسجّلة"}
      onVisibleColumnsChange={onVisibleColumnsChange}
    />
  );
}
