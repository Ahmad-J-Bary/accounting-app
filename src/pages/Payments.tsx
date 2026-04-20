import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, Printer, MoreHorizontal, Eye, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { payments } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Payments() {
  const receipts = payments.filter(p => p.type === "receipt");
  const outgoing = payments.filter(p => p.type === "payment");

  const renderTable = (list: typeof payments) => (
    <div className="border border-border rounded-md overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="bg-slate-50 border-b border-border">
          <tr>
            <th className="text-right px-4 py-3 font-medium">رقم السند</th>
            <th className="text-right px-4 py-3 font-medium">التاريخ</th>
            <th className="text-right px-4 py-3 font-medium">الجهة</th>
            <th className="text-right px-4 py-3 font-medium">طريقة الدفع</th>
            <th className="text-left px-4 py-3 font-medium">المبلغ</th>
            <th className="text-left px-4 py-3 font-medium">الحالة</th>
            <th className="text-left px-4 py-3 font-medium w-12"></th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0 hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-primary">{p.number}</td>
              <td className="px-4 py-3">{formatDate(p.date)}</td>
              <td className="px-4 py-3">{p.party}</td>
              <td className="px-4 py-3"><StatusBadge status={p.method} /></td>
              <td className="px-4 py-3 text-left tabular-nums font-medium">{formatCurrency(p.amount)}</td>
              <td className="px-4 py-3 text-left"><StatusBadge status={p.status} /></td>
              <td className="px-4 py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                    <DropdownMenuItem><Printer className="w-4 h-4 ml-2" />طباعة السند</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader
        title="المقبوضات والمدفوعات"
        subtitle="إدارة سندات القبض والصرف"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المقبوضات والمدفوعات" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button variant="outline"><ArrowDownCircle className="w-4 h-4 ml-2 text-green-600" />سند قبض</Button>
            <Button><ArrowUpCircle className="w-4 h-4 ml-2" />سند صرف</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي المقبوضات</div><div className="text-xl font-bold text-green-600 tabular-nums mt-1">{formatCurrency(receipts.reduce((s, p) => s + p.amount, 0))}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي المدفوعات</div><div className="text-xl font-bold text-red-600 tabular-nums mt-1">{formatCurrency(outgoing.reduce((s, p) => s + p.amount, 0))}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">صافي التدفق</div><div className="text-xl font-bold text-primary tabular-nums mt-1">{formatCurrency(receipts.reduce((s, p) => s + p.amount, 0) - outgoing.reduce((s, p) => s + p.amount, 0))}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">عدد العمليات</div><div className="text-xl font-bold tabular-nums mt-1">{payments.length}</div></Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث برقم السند أو الجهة..." className="pr-10" />
          </div>
          <Input type="date" className="w-[160px]" />
          <Input type="date" className="w-[160px]" />
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">الكل ({payments.length})</TabsTrigger>
            <TabsTrigger value="receipts">سندات القبض ({receipts.length})</TabsTrigger>
            <TabsTrigger value="payments">سندات الصرف ({outgoing.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">{renderTable(payments)}</TabsContent>
          <TabsContent value="receipts" className="mt-4">{renderTable(receipts)}</TabsContent>
          <TabsContent value="payments" className="mt-4">{renderTable(outgoing)}</TabsContent>
        </Tabs>
      </Card>

      {/* Voucher preview */}
      <Card className="mt-4 p-8 max-w-3xl mx-auto border-2 border-dashed border-border">
        <div className="text-center mb-4">
          <div className="text-xs text-muted-foreground mb-1">نموذج سند قبض</div>
          <h3 className="text-xl font-bold">سند قبض نقدي</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span className="text-muted-foreground">الرقم: </span><span className="font-medium">RCP-2026-0078</span></div>
          <div><span className="text-muted-foreground">التاريخ: </span><span className="font-medium">2026-04-18</span></div>
        </div>
        <div className="border border-border rounded-md p-4 mb-4 space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground">استلمنا من السيد</span><span className="font-bold">شركة النور للتجارة</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">مبلغاً وقدره</span><span className="font-bold text-primary tabular-nums">{formatCurrency(15000)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">وذلك عن</span><span>سداد فاتورة INV-2026-0145</span></div>
        </div>
        <div className="flex justify-between mt-8">
          <div className="text-center"><div className="text-xs text-muted-foreground mb-8">المستلم</div><div className="border-t border-border pt-1 w-32">التوقيع</div></div>
          <div className="text-center"><div className="text-xs text-muted-foreground mb-8">المحاسب</div><div className="border-t border-border pt-1 w-32">التوقيع</div></div>
        </div>
      </Card>
    </>
  );
}