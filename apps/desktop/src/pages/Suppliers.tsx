import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, MoreHorizontal, Eye, Edit, Printer } from "lucide-react";
import { suppliers } from "@/lib/mockData";
import { formatCurrency } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Suppliers() {
  return (
    <>
      <PageHeader
        title="الموردون"
        subtitle="إدارة قاعدة بيانات الموردين وأرصدتهم"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الموردون" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button><Plus className="w-4 h-4 ml-2" />مورد جديد</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي الموردين</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{suppliers.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">الموردون النشطون</div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{suppliers.filter(s => s.status === "active").length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي الذمم الدائنة</div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{formatCurrency(suppliers.reduce((s, x) => s + x.balance, 0))}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">موردون بأرصدة</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{suppliers.filter(s => s.balance > 0).length}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم، الكود، الهاتف..." className="pr-10" />
          </div>
          <Button variant="outline">جميع المدن</Button>
        </div>

        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium">الكود</th>
                <th className="text-right px-4 py-3 font-medium">اسم المورد</th>
                <th className="text-right px-4 py-3 font-medium">الهاتف</th>
                <th className="text-right px-4 py-3 font-medium">البريد</th>
                <th className="text-right px-4 py-3 font-medium">المدينة</th>
                <th className="text-left px-4 py-3 font-medium">الرصيد</th>
                <th className="text-left px-4 py-3 font-medium">الحالة</th>
                <th className="text-left px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-primary">{s.code}</td>
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3 tabular-nums">{s.phone}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.email}</td>
                  <td className="px-4 py-3">{s.city}</td>
                  <td className="px-4 py-3 text-left tabular-nums font-medium">{formatCurrency(s.balance)}</td>
                  <td className="px-4 py-3 text-left"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                        <DropdownMenuItem><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                        <DropdownMenuItem><Printer className="w-4 h-4 ml-2" />كشف حساب</DropdownMenuItem>
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