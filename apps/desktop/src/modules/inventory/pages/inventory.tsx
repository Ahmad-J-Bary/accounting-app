import { useState, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Download, Search, Warehouse, ArrowLeftRight, History, Package } from "lucide-react";
import { formatNumber, formatCurrency, formatDateTime } from '@shared/lib/format';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { useDataTable } from '@shared/hooks';
import { inventoryService } from '@modules/inventory/api/inventoryService';
import type { StockMovement } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

export default function Inventory() {
  const {
    filtered: movements,
    loading: movementsLoading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<StockMovement>({
    fetchData: () => inventoryService.listStockMovements(),
    searchFields: ["product_name", "reference"],
  });

  const isLoading = movementsLoading || refreshing;

  const movementColumns = useMemo<Column<StockMovement>[]>(() => [
    { 
      header: "التاريخ", 
      accessor: (m) => formatDateTime(m.date),
      className: "tabular-nums text-slate-500 font-medium" 
    },
    { 
      header: "النوع", 
      accessor: (m) => {
        const typeMap: Record<string, string> = {
          'In': 'وارد',
          'Out': 'صادر',
          'Adjustment': 'تسوية',
          'Production': 'تصنيع',
          'Damaged': 'تالف'
        };
        return (
          <span className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ring-1 ring-inset",
            m.movement_type === 'In' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
            m.movement_type === 'Out' ? 'bg-rose-50 text-rose-700 ring-rose-100' :
            'bg-blue-50 text-blue-700 ring-blue-100'
          )}>
            {typeMap[m.movement_type] || m.movement_type}
          </span>
        );
      },
      align: "center"
    },
    { 
      header: "الصنف / المنتج", 
      accessor: "product_name",
      className: "font-bold text-slate-900" 
    },
    { 
      header: "الكمية", 
      accessor: (m) => (
        <span className={cn("tabular-nums font-black text-base", parseFloat(m.quantity) < 0 ? "text-rose-600" : "text-emerald-600")}>
          {parseFloat(m.quantity) > 0 ? "+" : ""}{formatNumber(parseFloat(m.quantity))}
        </span>
      ), 
      align: "left"
    },
    { 
      header: "التكلفة (إجمالي)", 
      accessor: (m) => m.total_cost ? formatCurrency(parseFloat(m.total_cost)) : "—",
      className: "tabular-nums text-slate-600 font-medium"
    },
    { 
      header: "المرجع", 
      accessor: "reference", 
      className: "text-blue-600 hover:text-blue-800 font-bold font-mono text-xs cursor-pointer bg-blue-50/50 px-2 py-1 rounded border border-blue-100 w-fit" 
    }
  ], []);

  const warehouses = useMemo(() => [
    { name: "المستودع الرئيسي - دمشق", items: 245, value: 87000, color: "bg-blue-600" },
    { name: "مستودع حلب", items: 128, value: 34000, color: "bg-indigo-600" },
  ], []);

  const stats = useMemo(() => [
    { label: "إجمالي الحركات", value: movements.length, icon: History, color: "text-blue-600" },
    { label: "قيمة المخزون الكلية", value: "$121,000", icon: Package, color: "text-emerald-600" },
    { label: "المستودعات النشطة", value: warehouses.length, icon: Warehouse, color: "text-slate-900" },
  ], [movements, warehouses]);

  return (
    <OperationalTableTemplate
      title="إدارة المخزون"
      toolbar={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-white"><Download className="w-4 h-4 ml-2" />تصدير</Button>
          <Button size="sm" onClick={() => toast.info("تحويل مخزني قيد التطوير")} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <ArrowLeftRight className="w-4 h-4 ml-2" />تحويل مخزني
          </Button>
          <Button size="sm" onClick={() => toast.info("إضافة حركة قيد التطوير")} className="bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-200">
            <Plus className="w-4 h-4 ml-2" />حركة جديدة
          </Button>

          <div className="flex items-center gap-6 mr-auto pl-2">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-start gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{s.label}</span>
                <div className="flex items-center gap-2">
                   <s.icon className={cn("w-4 h-4", s.color)} />
                   <span className={cn("text-lg font-black tabular-nums", s.color)}>{s.value}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      }
      tableContent={
        <Tabs defaultValue="movements" className="w-full h-full flex flex-col">
          <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/50">
            <TabsList className="bg-white border p-1 h-11 rounded-xl shadow-sm">
              <TabsTrigger value="movements" className="rounded-lg px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">سجل الحركات</TabsTrigger>
              <TabsTrigger value="warehouses" className="rounded-lg px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">حالة المستودعات</TabsTrigger>
            </TabsList>
            
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="بحث..." 
                className="pr-10 h-10 border-slate-200 bg-white" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value="movements" className="flex-1 m-0 p-0 overflow-auto">
            <DataTable
              data={movements}
              columns={movementColumns}
              loading={movementsLoading}
              emptyMessage="لا توجد حركات مخزنية مسجلة"
            />
          </TabsContent>

          <TabsContent value="warehouses" className="flex-1 m-0 p-8 overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {warehouses.map((w, i) => (
                <div key={i} className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300">
                  <div className="flex items-start justify-between mb-8">
                    <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner", w.color)}>
                      <Warehouse className="w-8 h-8 text-white" />
                    </div>
                    <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider border border-emerald-100">نشط</div>
                  </div>
                  
                  <h3 className="font-black text-slate-900 text-xl mb-6">{w.name}</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-blue-50/30 group-hover:border-blue-100 transition-colors">
                      <div className="text-xs font-bold text-slate-400">عدد الأصناف</div>
                      <div className="font-black tabular-nums text-slate-900 text-lg">{formatNumber(w.items)}</div>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-blue-50/30 group-hover:border-blue-100 transition-colors">
                      <div className="text-xs font-bold text-slate-400">قيمة المخزون</div>
                      <div className="font-black tabular-nums text-blue-600 text-lg">{formatCurrency(w.value)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      }
    />
  );
}