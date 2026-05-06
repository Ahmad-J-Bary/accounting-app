import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, Factory, CheckCircle, Clock, Banknote, History } from "lucide-react";
import { formatCurrency, formatDate } from '@shared/lib/format';
import { productionService } from '@modules/inventory/api/inventoryService';
import type { ProductionOrder } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { useDataTable } from '@shared/hooks';
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  Draft: { label: "مسودة", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  InProgress: { label: "جاري التنفيذ", cls: "bg-blue-50 text-blue-700 ring-blue-100" },
  Completed: { label: "مكتمل", cls: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  Cancelled: { label: "ملغي", cls: "bg-rose-50 text-rose-700 ring-rose-100" },
};

export default function Production() {
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

  const completed = useMemo(() => orders.filter(o => o.status === "Completed").length, [orders]);
  const inProgress = useMemo(() => orders.filter(o => o.status === "InProgress").length, [orders]);
  const totalCost = useMemo(() => orders.reduce((s, o) => s + parseFloat(o.total_cost || "0"), 0), [orders]);

  const columns = useMemo<Column<ProductionOrder>[]>(() => [
    { 
      header: "رقم الأمر", 
      accessor: "order_number", 
      className: "font-black text-blue-600 font-mono" 
    },
    { 
      header: "التاريخ", 
      accessor: (o) => formatDate(o.production_date),
      className: "tabular-nums text-slate-500 font-medium"
    },
    { 
      header: "المواد الخام", 
      accessor: (o) => (
        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold text-xs">
          {o.materials.length} أصناف
        </span>
      ),
      align: "center"
    },
    { 
      header: "المنتجات التامة", 
      accessor: (o) => (
        <span className="inline-flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded text-blue-600 font-bold text-xs">
          {o.outputs.length} منتجات
        </span>
      ),
      align: "center"
    },
    { 
      header: "إجمالي التكلفة", 
      accessor: (o) => formatCurrency(parseFloat(o.total_cost)), 
      align: "left", 
      className: "tabular-nums font-black text-slate-900" 
    },
    { 
      header: "الحالة", 
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
      align: "center"
    }
  ], []);

  const stats = useMemo(() => [
    { label: "إجمالي الأوامر", value: orders.length, icon: Factory, color: "text-slate-900" },
    { label: "جاري التنفيذ", value: inProgress, icon: Clock, color: "text-blue-600" },
    { label: "أوامر مكتملة", value: completed, icon: CheckCircle, color: "text-emerald-600" },
    { label: "إجمالي التكاليف", value: formatCurrency(totalCost), icon: Banknote, color: "text-indigo-600" },
  ], [orders, inProgress, completed, totalCost]);

  return (
    <OperationalTableTemplate
      title="أوامر الإنتاج"
      toolbar={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading} className="bg-white">
            <RefreshCw className={cn("w-4 h-4 ml-2", loading && "animate-spin")} />تحديث
          </Button>
          <Button size="sm" onClick={() => toast.info("أمر إنتاج جديد قيد التطوير")} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" />أمر إنتاج جديد
          </Button>
        </div>
      }
      headerWidgets={
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                <div className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</div>
              </div>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50", s.color)}>
                <s.icon className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث برقم الأمر..."
              className="pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      }
      tableContent={
        <DataTable
          data={orders}
          columns={columns}
          loading={loading}
          emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد أوامر إنتاج مسجّلة"}
        />
      }
    />
  );
}