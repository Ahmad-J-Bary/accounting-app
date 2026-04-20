import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, Eye, MoreHorizontal } from "lucide-react";
import { damagedItems } from "@/lib/mockData";
import { formatDate, formatNumber } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Damaged() {
  return (
    <>
      <PageHeader
        title="التالف والهدر"
        subtitle="تسجيل ومتابعة الأصناف التالفة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المخزون" }, { label: "التالف" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button><Plus className="w-4 h-4 ml-2" />تسجيل تالف</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي السجلات</div><div className="text-2xl font-bold tabular-nums mt-1">{damagedItems.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">قيد المراجعة</div><div className="text-2xl font-bold text-amber-600 tabular-nums mt-1">{damagedItems.filter(d => d.status === "pending").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">معتمدة</div><div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{damagedItems.filter(d => d.status === "approved").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">مرفوضة</div><div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{damagedItems.filter(d => d.status === "rejected").length}</div></Card>
      </div>

      <Card className="p-5">
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
                <th className="text-right px-4 py-3 font-medium">المنتج</th>
                <th className="text-left px-4 py-3 font-medium">الكمية</th>
                <th className="text-right px-4 py-3 font-medium">السبب</th>
                <th className="text-left px-4 py-3 font-medium">الحالة</th>
                <th className="text-left px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {damagedItems.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-primary">{d.number}</td>
                  <td className="px-4 py-3">{formatDate(d.date)}</td>
                  <td className="px-4 py-3">{d.product}</td>
                  <td className="px-4 py-3 text-left tabular-nums">{formatNumber(d.quantity)}</td>
                  <td className="px-4 py-3">{d.reason}</td>
                  <td className="px-4 py-3 text-left"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                        <DropdownMenuItem className="text-green-600">موافقة</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">رفض</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}