import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, Warehouse, ArrowLeftRight } from "lucide-react";
import { stockMovements, products } from "@/lib/mockData";
import { formatDate, formatNumber, formatCurrency } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { useMemo, useState } from "react";

interface StockMovement {
  number: string;
  date: string;
  type: string;
  product: string;
  warehouse: string;
  quantity: number;
  reference: string;
}

interface LedgerEntry {
  date: string;
  ref: string;
  desc: string;
  in: string;
  out: string;
  balance: string;
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  
  const warehouses = [
    { name: "المستودع الرئيسي - دمشق", items: 245, value: 87000 },
    { name: "مستودع حلب", items: 128, value: 34000 },
    { name: "مستودع حمص", items: 89, value: 21000 },
  ];

  const movementColumns = useMemo<Column<StockMovement>[]>(() => [
    { 
      header: "رقم الحركة", 
      accessor: "number", 
      className: "font-bold text-primary" 
    },
    { 
      header: "التاريخ", 
      accessor: (m) => formatDate(m.date),
      className: "text-slate-500" 
    },
    { 
      header: "النوع", 
      accessor: (m) => <StatusBadge status={m.type} />,
      align: "center"
    },
    { 
      header: "المنتج", 
      accessor: "product",
      className: "font-medium" 
    },
    { 
      header: "المستودع", 
      accessor: "warehouse",
      className: "text-slate-600" 
    },
    { 
      header: "الكمية", 
      accessor: (m) => formatNumber(m.quantity), 
      align: "left", 
      className: "tabular-nums font-bold" 
    },
    { 
      header: "المرجع", 
      accessor: "reference", 
      align: "left", 
      className: "text-primary hover:underline cursor-pointer" 
    }
  ], []);

  const ledgerColumns = useMemo<Column<LedgerEntry>[]>(() => [
    { header: "التاريخ", accessor: "date" },
    { header: "المرجع", accessor: "ref", className: "text-primary font-medium" },
    { header: "البيان", accessor: "desc" },
    { header: "وارد", accessor: "in", align: "left", className: "text-green-600 tabular-nums font-bold" },
    { header: "صادر", accessor: "out", align: "left", className: "text-red-600 tabular-nums font-bold" },
    { header: "الرصيد", accessor: "balance", align: "left", className: "tabular-nums font-extrabold text-slate-900" },
  ], []);

  const ledgerData = [
    { date: "2026-04-01", ref: "رصيد افتتاحي", desc: "-", in: "25", out: "-", balance: "25" },
    { date: "2026-04-18", ref: "PUR-2026-0089", desc: "شراء", in: "20", out: "-", balance: "45" },
    { date: "2026-04-18", ref: "INV-2026-0145", desc: "بيع", in: "-", out: "0", balance: "45" },
  ];

  return (
    <>
      <PageHeader
        title="حركات المخزون"
        subtitle="متابعة حركة الأصناف بين المستودعات"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المخزون" }, { label: "الحركات" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button variant="outline"><ArrowLeftRight className="w-4 h-4 ml-2" />تحويل مخزني</Button>
            <Button><Plus className="w-4 h-4 ml-2" />حركة جديدة</Button>
          </>
        }
      />

      <Tabs defaultValue="movements">
        <TabsList className="bg-slate-100/50 p-1">
          <TabsTrigger value="movements">الحركات</TabsTrigger>
          <TabsTrigger value="warehouses">المستودعات</TabsTrigger>
          <TabsTrigger value="ledger">دفتر الأستاذ المخزني</TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="mt-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="بحث برقم الحركة أو المنتج..." 
                  className="pr-10" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline">تصفية حسب النوع</Button>
              <Button variant="outline">تصفية حسب المستودع</Button>
            </div>

            <DataTable
              data={stockMovements}
              columns={movementColumns}
              loading={false}
              emptyMessage="لا توجد حركات مخزنية مسجلة"
            />
          </Card>
        </TabsContent>

        <TabsContent value="warehouses" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {warehouses.map((w, i) => (
              <Card key={i} className="p-5 hover:shadow-lg transition-shadow border-slate-100">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Warehouse className="w-5 h-5 text-blue-600" />
                  </div>
                  <StatusBadge status="active" />
                </div>
                <h3 className="font-bold text-slate-800 mb-1">{w.name}</h3>
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-50">
                  <div>
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">عدد الأصناف</div>
                    <div className="font-bold tabular-nums text-slate-900">{formatNumber(w.items)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">قيمة المخزون</div>
                    <div className="font-bold tabular-nums text-primary">{formatCurrency(w.value)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-slate-800">دفتر الأستاذ المخزني - {products[0].name}</h3>
              <Button variant="ghost" size="sm" className="text-primary">تغيير المنتج</Button>
            </div>
            
            <DataTable
              data={ledgerData}
              columns={ledgerColumns}
              loading={false}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}