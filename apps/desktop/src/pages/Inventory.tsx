import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, Warehouse, ArrowLeftRight } from "lucide-react";
import { stockMovements, products } from "@/lib/mockData";
import { formatDate, formatNumber, formatCurrency } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Inventory() {
  const warehouses = [
    { name: "المستودع الرئيسي - دمشق", items: 245, value: 87000 },
    { name: "مستودع حلب", items: 128, value: 34000 },
    { name: "مستودع حمص", items: 89, value: 21000 },
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
        <TabsList>
          <TabsTrigger value="movements">الحركات</TabsTrigger>
          <TabsTrigger value="warehouses">المستودعات</TabsTrigger>
          <TabsTrigger value="ledger">دفتر الأستاذ المخزني</TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="mt-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث برقم الحركة أو المنتج..." className="pr-10" />
              </div>
              <Button variant="outline">النوع</Button>
              <Button variant="outline">المستودع</Button>
            </div>

            <div className="border border-border rounded-md overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    <th className="text-right px-4 py-3 font-medium">رقم الحركة</th>
                    <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                    <th className="text-right px-4 py-3 font-medium">النوع</th>
                    <th className="text-right px-4 py-3 font-medium">المنتج</th>
                    <th className="text-right px-4 py-3 font-medium">المستودع</th>
                    <th className="text-left px-4 py-3 font-medium">الكمية</th>
                    <th className="text-left px-4 py-3 font-medium">المرجع</th>
                  </tr>
                </thead>
                <tbody>
                  {stockMovements.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-primary">{m.number}</td>
                      <td className="px-4 py-3">{formatDate(m.date)}</td>
                      <td className="px-4 py-3"><StatusBadge status={m.type} /></td>
                      <td className="px-4 py-3">{m.product}</td>
                      <td className="px-4 py-3">{m.warehouse}</td>
                      <td className="px-4 py-3 text-left tabular-nums font-medium">{formatNumber(m.quantity)}</td>
                      <td className="px-4 py-3 text-left text-primary">{m.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="warehouses" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {warehouses.map((w, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Warehouse className="w-5 h-5 text-blue-600" />
                  </div>
                  <StatusBadge status="active" />
                </div>
                <h3 className="font-bold mb-1">{w.name}</h3>
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground">عدد الأصناف</div>
                    <div className="font-bold tabular-nums">{formatNumber(w.items)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">قيمة المخزون</div>
                    <div className="font-bold tabular-nums text-primary">{formatCurrency(w.value)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">دفتر الأستاذ المخزني - {products[0].name}</h3>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium">المرجع</th>
                  <th className="text-right px-4 py-3 font-medium">البيان</th>
                  <th className="text-left px-4 py-3 font-medium">وارد</th>
                  <th className="text-left px-4 py-3 font-medium">صادر</th>
                  <th className="text-left px-4 py-3 font-medium">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border hover:bg-slate-50"><td className="px-4 py-3">2026-04-01</td><td className="px-4 py-3">رصيد افتتاحي</td><td className="px-4 py-3">-</td><td className="px-4 py-3 text-left tabular-nums">25</td><td className="px-4 py-3 text-left tabular-nums">-</td><td className="px-4 py-3 text-left tabular-nums font-bold">25</td></tr>
                <tr className="border-b border-border hover:bg-slate-50"><td className="px-4 py-3">2026-04-18</td><td className="px-4 py-3 text-primary">PUR-2026-0089</td><td className="px-4 py-3">شراء</td><td className="px-4 py-3 text-left tabular-nums text-green-600">20</td><td className="px-4 py-3 text-left tabular-nums">-</td><td className="px-4 py-3 text-left tabular-nums font-bold">45</td></tr>
                <tr className="border-b border-border hover:bg-slate-50"><td className="px-4 py-3">2026-04-18</td><td className="px-4 py-3 text-primary">INV-2026-0145</td><td className="px-4 py-3">بيع</td><td className="px-4 py-3 text-left tabular-nums">-</td><td className="px-4 py-3 text-left tabular-nums text-red-600">0</td><td className="px-4 py-3 text-left tabular-nums font-bold">45</td></tr>
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}