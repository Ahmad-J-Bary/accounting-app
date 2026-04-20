import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, MoreHorizontal, Eye, Edit, Printer } from "lucide-react";
import { purchaseInvoices } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PurchaseInvoices() {
  return (
    <>
      <PageHeader
        title="فواتير المشتريات"
        subtitle="إدارة فواتير الشراء من الموردين"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المشتريات" }, { label: "الفواتير" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button><Plus className="w-4 h-4 ml-2" />فاتورة شراء جديدة</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي الفواتير</div><div className="text-2xl font-bold tabular-nums mt-1">{purchaseInvoices.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">مدفوعة</div><div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{purchaseInvoices.filter(i => i.status === "paid").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">جزئية</div><div className="text-2xl font-bold text-amber-600 tabular-nums mt-1">{purchaseInvoices.filter(i => i.status === "partial").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">متأخرة</div><div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{purchaseInvoices.filter(i => i.status === "overdue").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">الإجمالي</div><div className="text-xl font-bold text-primary tabular-nums mt-1">{formatCurrency(purchaseInvoices.reduce((s, i) => s + i.total, 0))}</div></Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث برقم الفاتورة أو المورد..." className="pr-10" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="paid">مدفوعة</SelectItem>
              <SelectItem value="partial">جزئية</SelectItem>
              <SelectItem value="unpaid">غير مدفوعة</SelectItem>
              <SelectItem value="overdue">متأخرة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium">رقم الفاتورة</th>
                <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium">المورد</th>
                <th className="text-left px-4 py-3 font-medium">الإجمالي</th>
                <th className="text-left px-4 py-3 font-medium">المدفوع</th>
                <th className="text-left px-4 py-3 font-medium">المتبقي</th>
                <th className="text-left px-4 py-3 font-medium">الحالة</th>
                <th className="text-left px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {purchaseInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-primary">{inv.number}</td>
                  <td className="px-4 py-3">{formatDate(inv.date)}</td>
                  <td className="px-4 py-3">{inv.partyName}</td>
                  <td className="px-4 py-3 text-left tabular-nums font-medium">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-3 text-left tabular-nums text-green-600">{formatCurrency(inv.paid)}</td>
                  <td className="px-4 py-3 text-left tabular-nums text-red-600">{formatCurrency(inv.total - inv.paid)}</td>
                  <td className="px-4 py-3 text-left"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                        <DropdownMenuItem><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                        <DropdownMenuItem><Printer className="w-4 h-4 ml-2" />طباعة</DropdownMenuItem>
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