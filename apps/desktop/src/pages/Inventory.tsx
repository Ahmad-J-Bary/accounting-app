import { useState, useMemo } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, Warehouse, ArrowLeftRight, RefreshCw } from "lucide-react";
import { formatDate, formatNumber, formatCurrency } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { inventoryService } from "@/services/inventoryService";
import type { StockMovement } from "@erp/shared-types";
import { toast } from "sonner";

export default function Inventory() {
  const {
    filtered: movements,
    loading: movementsLoading,
    search,
    setSearch,
    refresh,
  } = useDataTable<StockMovement>({
    fetchData: () => inventoryService.listStockMovements(),
    searchFields: ["product_name", "reference"],
    errorLabel: "فشل تحميل حركات المخزون",
  });

  const movementColumns = useMemo<Column<StockMovement>[]>(() => [
    { 
      header: "التاريخ", 
      accessor: (m) => formatDate(m.date),
      className: "tabular-nums text-slate-500" 
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
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-inset ${
            m.movement_type === 'In' ? 'bg-green-50 text-green-700 ring-green-100' :
            m.movement_type === 'Out' ? 'bg-red-50 text-red-700 ring-red-100' :
            'bg-blue-50 text-blue-700 ring-blue-100'
          }`}>
            {typeMap[m.movement_type] || m.movement_type}
          </span>
        );
      },
      align: "center"
    },
    { 
      header: "الصنف / المنتج", 
      accessor: "product_name",
      className: "font-bold text-slate-800" 
    },
    { 
      header: "الكمية", 
      accessor: (m) => (
        <span className={`tabular-nums font-bold ${parseFloat(m.quantity) < 0 ? "text-red-600" : "text-green-600"}`}>
          {formatNumber(parseFloat(m.quantity))}
        </span>
      ), 
      align: "left"
    },
    { 
      header: "التكلفة (إجمالي)", 
      accessor: (m) => m.total_cost ? formatCurrency(parseFloat(m.total_cost)) : "—",
      className: "tabular-nums text-slate-600"
    },
    { 
      header: "المرجع", 
      accessor: "reference", 
      className: "text-primary hover:underline cursor-pointer font-medium" 
    }
  ], []);

  const warehouses = [
    { name: "المستودع الرئيسي - دمشق", items: 245, value: 87000 },
    { name: "مستودع حلب", items: 128, value: 34000 },
  ];

  return (
    <>
      <PageHeader
        title="إدارة المخزون"
        subtitle="متابعة حركات الأصناف وحالة المستودعات"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المخزون" }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refresh()} disabled={movementsLoading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${movementsLoading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button onClick={() => toast.info("تحويل مخزني قيد التطوير")}>
              <ArrowLeftRight className="w-4 h-4 ml-2" />تحويل مخزني
            </Button>
            <Button onClick={() => toast.info("إضافة حركة قيد التطوير")}>
              <Plus className="w-4 h-4 ml-2" />حركة جديدة
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="movements">
        <TabsList className="bg-white border p-1 h-12 rounded-xl shadow-sm mb-6">
          <TabsTrigger value="movements" className="rounded-lg px-6 gap-2">الحركات</TabsTrigger>
          <TabsTrigger value="warehouses" className="rounded-lg px-6 gap-2">المستودعات</TabsTrigger>
        </TabsList>

        <TabsContent value="movements">
          <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="بحث بالصنف أو المرجع..." 
                  className="pr-10 border-slate-200 focus:ring-primary/20" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <DataTable
              data={movements}
              columns={movementColumns}
              loading={movementsLoading}
              emptyMessage="لا توجد حركات مخزنية مسجلة"
            />
          </Card>
        </TabsContent>

        <TabsContent value="warehouses">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((w, i) => (
              <Card key={i} className="p-5 border-none shadow-sm ring-1 ring-slate-100 hover:ring-primary/30 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Warehouse className="w-6 h-6 text-blue-600" />
                  </div>
                  <StatusBadge status="active" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-1">{w.name}</h3>
                <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-slate-50">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">عدد الأصناف</div>
                    <div className="font-bold tabular-nums text-slate-900 text-xl">{formatNumber(w.items)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">قيمة المخزون</div>
                    <div className="font-bold tabular-nums text-primary text-xl">{formatCurrency(w.value)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}