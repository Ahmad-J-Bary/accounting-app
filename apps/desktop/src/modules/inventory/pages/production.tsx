import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Factory, CheckCircle, Clock, Banknote } from "lucide-react";
import { formatCurrency, formatDateTime } from '@shared/lib/format';
import { productionService } from '@modules/inventory/api/inventoryService';
import type { ProductionOrder } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

// Refactored Components & Hooks
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useDataTable, useUnifiedColumns } from '@shared/hooks';
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  Draft: { label: "مسودة", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  InProgress: { label: "جاري التنفيذ", cls: "bg-blue-50 text-blue-700 ring-blue-100" },
  Completed: { label: "مكتمل", cls: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  Cancelled: { label: "ملغي", cls: "bg-rose-50 text-rose-700 ring-rose-100" },
};

export default function ProductionPage() {
  const {
    filtered: orders,
    loading,
    search,
    setSearch,
    refresh,
  } = useDataTable<ProductionOrder>({
    fetchData: () => productionService.listProductionOrders(),
    searchFields: ["order_number"],
  });

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

  const completed = useMemo(() => orders.filter(o => o.status === "Completed").length, [orders]);
  const inProgress = useMemo(() => orders.filter(o => o.status === "InProgress").length, [orders]);
  const totalCost = useMemo(() => orders.reduce((s, o) => s + parseFloat(o.total_cost || "0"), 0), [orders]);

  const stats = useMemo(() => [
    { label: "إجمالي الأوامر", value: orders.length, icon: Factory, color: "text-slate-900" },
    { label: "جاري التنفيذ", value: inProgress, icon: Clock, color: "text-blue-600" },
    { label: "أوامر مكتملة", value: completed, icon: CheckCircle, color: "text-emerald-600" },
    { label: "إجمالي التكاليف", value: formatCurrency(totalCost), icon: Banknote, color: "text-indigo-600" },
  ], [orders.length, inProgress, completed, totalCost]);

  return (
    <OperationalTableTemplate
      title="أوامر الإنتاج"
      stats={stats}
      toolbar={
        <Button size="sm" onClick={() => toast.info("أمر إنتاج جديد قيد التطوير")} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
          <Plus className="w-4 h-4 ml-2" /> أمر إنتاج جديد
        </Button>
      }
      tableContent={
        <TableShell
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث برقم الأمر..."
          columns={toolbarColumns}
          onColumnToggle={toggleColumn}
        >
          <UnifiedTable
            data={orders}
            columns={enrichedColumns}
            loading={loading}
            emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد أوامر إنتاج مسجّلة"}
          />
        </TableShell>
      }
    />
  );
}
