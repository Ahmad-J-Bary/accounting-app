import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, Eye, MoreHorizontal } from "lucide-react";
import { productionOrders } from "@/lib/mockData";
import { formatDate, formatNumber } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Production() {
  return (
    <>
      <PageHeader
        title="أوامر الإنتاج"
        subtitle="متابعة عمليات التصنيع والإنتاج"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الإنتاج" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button><Plus className="w-4 h-4 ml-2" />أمر إنتاج جديد</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي الأوامر</div><div className="text-2xl font-bold tabular-nums mt-1">{productionOrders.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">مخططة</div><div className="text-2xl font-bold text-slate-600 tabular-nums mt-1">{productionOrders.filter(p => p.status === "planned").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">قيد التنفيذ</div><div className="text-2xl font-bold text-blue-600 tabular-nums mt-1">{productionOrders.filter(p => p.status === "in_progress").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">مكتملة</div><div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{productionOrders.filter(p => p.status === "completed").length}</div></Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث..." className="pr-10" />
          </div>
        </div>

        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium">رقم الأمر</th>
                <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium">المنتج</th>
                <th className="text-left px-4 py-3 font-medium">الكمية</th>
                <th className="text-left px-4 py-3 font-medium">الحالة</th>
                <th className="text-left px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {productionOrders.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-primary">{p.number}</td>
                  <td className="px-4 py-3">{formatDate(p.date)}</td>
                  <td className="px-4 py-3">{p.product}</td>
                  <td className="px-4 py-3 text-left tabular-nums font-medium">{formatNumber(p.quantity)}</td>
                  <td className="px-4 py-3 text-left"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض التفاصيل</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 mt-4">
        <h3 className="font-semibold mb-4">تفاصيل أمر الإنتاج PRD-2026-0034</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">المواد المستهلكة</h4>
            <table className="w-full text-sm border border-border rounded-md">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right px-3 py-2">المادة</th>
                  <th className="text-left px-3 py-2">الكمية</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border"><td className="px-3 py-2">خشب الزان</td><td className="px-3 py-2 text-left tabular-nums">400 م²</td></tr>
                <tr className="border-t border-border"><td className="px-3 py-2">براغي ومسامير</td><td className="px-3 py-2 text-left tabular-nums">800 قطعة</td></tr>
                <tr className="border-t border-border"><td className="px-3 py-2">دهان لامع</td><td className="px-3 py-2 text-left tabular-nums">60 لتر</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">المخرجات</h4>
            <table className="w-full text-sm border border-border rounded-md">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right px-3 py-2">المنتج</th>
                  <th className="text-left px-3 py-2">الكمية المنتجة</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border"><td className="px-3 py-2">مكتب خشبي فاخر</td><td className="px-3 py-2 text-left tabular-nums">18 / 20</td></tr>
              </tbody>
            </table>
            <div className="mt-3 p-3 bg-blue-50 rounded-md text-sm text-blue-700">نسبة الإنجاز: 90%</div>
          </div>
        </div>
      </Card>
    </>
  );
}