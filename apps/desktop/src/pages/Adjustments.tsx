import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search } from "lucide-react";
import { stockAdjustments } from "@/lib/mockData";
import { formatDate, formatNumber, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function Adjustments() {
  return (
    <>
      <PageHeader
        title="تسويات المخزون والجرد"
        subtitle="جرد الأصناف وتسوية الفروقات"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المخزون" }, { label: "التسويات" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button><Plus className="w-4 h-4 ml-2" />جرد جديد</Button>
          </>
        }
      />

      <Card className="p-5 mb-4">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث..." className="pr-10" />
          </div>
        </div>

        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium">الرقم</th>
                <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium">المستودع</th>
                <th className="text-left px-4 py-3 font-medium">عدد الأصناف</th>
                <th className="text-left px-4 py-3 font-medium">قيمة الفروقات</th>
                <th className="text-left px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {stockAdjustments.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-primary">{a.number}</td>
                  <td className="px-4 py-3">{formatDate(a.date)}</td>
                  <td className="px-4 py-3">{a.warehouse}</td>
                  <td className="px-4 py-3 text-left tabular-nums">{formatNumber(a.itemsCount)}</td>
                  <td className={cn("px-4 py-3 text-left tabular-nums font-medium", a.variance < 0 ? "text-red-600" : "text-green-600")}>
                    {a.variance > 0 ? "+" : ""}{formatCurrency(a.variance)}
                  </td>
                  <td className="px-4 py-3 text-left"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">تفاصيل الجرد ADJ-2026-0012 - عرض الفروقات</h3>
        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium">الصنف</th>
                <th className="text-left px-4 py-3 font-medium">الكمية الدفترية</th>
                <th className="text-left px-4 py-3 font-medium">الكمية الفعلية</th>
                <th className="text-left px-4 py-3 font-medium">الفرق</th>
                <th className="text-left px-4 py-3 font-medium">قيمة الفرق</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border"><td className="px-4 py-3">جهاز كمبيوتر محمول HP</td><td className="px-4 py-3 text-left tabular-nums">45</td><td className="px-4 py-3 text-left tabular-nums">44</td><td className="px-4 py-3 text-left tabular-nums text-red-600">-1</td><td className="px-4 py-3 text-left tabular-nums text-red-600">-2,800.00</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-3">ورق تصوير A4</td><td className="px-4 py-3 text-left tabular-nums">320</td><td className="px-4 py-3 text-left tabular-nums">315</td><td className="px-4 py-3 text-left tabular-nums text-red-600">-5</td><td className="px-4 py-3 text-left tabular-nums text-red-600">-90.00</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-3">كرسي مكتبي تنفيذي</td><td className="px-4 py-3 text-left tabular-nums">3</td><td className="px-4 py-3 text-left tabular-nums">5</td><td className="px-4 py-3 text-left tabular-nums text-green-600">+2</td><td className="px-4 py-3 text-left tabular-nums text-green-600">+1,300.00</td></tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}