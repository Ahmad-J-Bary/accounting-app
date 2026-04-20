import { useState } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, MoreHorizontal, Eye, Edit, Printer, Send, FileText } from "lucide-react";
import { salesInvoices, customers, products } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SalesInvoices() {
  const [preview, setPreview] = useState<string | null>(null);
  const selectedInv = salesInvoices.find(i => i.id === preview);

  return (
    <>
      <PageHeader
        title="فواتير المبيعات"
        subtitle="إدارة فواتير المبيعات والمتابعة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المبيعات" }, { label: "الفواتير" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button><Plus className="w-4 h-4 ml-2" />فاتورة جديدة</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي الفواتير</div><div className="text-2xl font-bold tabular-nums mt-1">{salesInvoices.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">مدفوعة</div><div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{salesInvoices.filter(i => i.status === "paid").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">جزئية</div><div className="text-2xl font-bold text-amber-600 tabular-nums mt-1">{salesInvoices.filter(i => i.status === "partial").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">متأخرة</div><div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{salesInvoices.filter(i => i.status === "overdue").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">الإجمالي</div><div className="text-xl font-bold text-primary tabular-nums mt-1">{formatCurrency(salesInvoices.reduce((s, i) => s + i.total, 0))}</div></Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث برقم الفاتورة أو العميل..." className="pr-10" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="paid">مدفوعة</SelectItem>
              <SelectItem value="partial">جزئية</SelectItem>
              <SelectItem value="unpaid">غير مدفوعة</SelectItem>
              <SelectItem value="overdue">متأخرة</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" className="w-[160px]" />
          <Input type="date" className="w-[160px]" />
        </div>

        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium">رقم الفاتورة</th>
                <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium">العميل</th>
                <th className="text-left px-4 py-3 font-medium">الإجمالي</th>
                <th className="text-left px-4 py-3 font-medium">المدفوع</th>
                <th className="text-left px-4 py-3 font-medium">المتبقي</th>
                <th className="text-left px-4 py-3 font-medium">الحالة</th>
                <th className="text-left px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {salesInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-primary cursor-pointer" onClick={() => setPreview(inv.id)}>{inv.number}</td>
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
                        <DropdownMenuItem onClick={() => setPreview(inv.id)}><Eye className="w-4 h-4 ml-2" />معاينة</DropdownMenuItem>
                        <DropdownMenuItem><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                        <DropdownMenuItem><Printer className="w-4 h-4 ml-2" />طباعة</DropdownMenuItem>
                        <DropdownMenuItem><Send className="w-4 h-4 ml-2" />إرسال</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invoice preview dialog - printable */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>معاينة الفاتورة</span>
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-2" />طباعة</Button>
            </DialogTitle>
          </DialogHeader>
          {selectedInv && (
            <div className="print-area bg-white border border-border rounded-md p-8">
              <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-primary">
                <div>
                  <h2 className="text-2xl font-bold text-primary">فاتورة ضريبية</h2>
                  <p className="text-sm text-muted-foreground mt-1">Tax Invoice</p>
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">شركة النجاح التجارية</div>
                  <div className="text-xs text-muted-foreground">الرقم الضريبي: 300123456700003</div>
                  <div className="text-xs text-muted-foreground">الرياض، المملكة العربية السعودية</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">فاتورة إلى</div>
                  <div className="font-bold">{selectedInv.partyName}</div>
                  <div className="text-sm text-muted-foreground">الرياض، المملكة العربية السعودية</div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">رقم الفاتورة:</span><span className="font-medium">{selectedInv.number}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">التاريخ:</span><span>{formatDate(selectedInv.date)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">تاريخ الاستحقاق:</span><span>{formatDate(selectedInv.date)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-muted-foreground">الحالة:</span><StatusBadge status={selectedInv.status} /></div>
                </div>
              </div>

              <table className="w-full text-sm mb-6 border border-border">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-right px-3 py-2 font-medium">#</th>
                    <th className="text-right px-3 py-2 font-medium">الصنف</th>
                    <th className="text-left px-3 py-2 font-medium">الكمية</th>
                    <th className="text-left px-3 py-2 font-medium">السعر</th>
                    <th className="text-left px-3 py-2 font-medium">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 3).map((p, i) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-left tabular-nums">2</td>
                      <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(p.price)}</td>
                      <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(p.price * 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end mb-6">
                <div className="w-72 space-y-1 text-sm">
                  <div className="flex justify-between py-1"><span>المجموع الفرعي</span><span className="tabular-nums">{formatCurrency(selectedInv.total / 1.15)}</span></div>
                  <div className="flex justify-between py-1"><span>الخصم</span><span className="tabular-nums">0.00</span></div>
                  <div className="flex justify-between py-1"><span>ضريبة القيمة المضافة (15%)</span><span className="tabular-nums">{formatCurrency(selectedInv.total - selectedInv.total / 1.15)}</span></div>
                  <div className="flex justify-between py-2 border-t-2 border-primary font-bold text-base"><span>الإجمالي</span><span className="tabular-nums">{formatCurrency(selectedInv.total)}</span></div>
                  <div className="flex justify-between py-1 text-green-600"><span>المدفوع</span><span className="tabular-nums">{formatCurrency(selectedInv.paid)}</span></div>
                  <div className="flex justify-between py-1 text-red-600 font-bold"><span>المتبقي</span><span className="tabular-nums">{formatCurrency(selectedInv.total - selectedInv.paid)}</span></div>
                </div>
              </div>

              <div className="border-t border-border pt-4 text-xs text-muted-foreground">
                <div className="font-medium text-slate-700 mb-1">ملاحظات:</div>
                <div>شكراً لتعاملكم معنا. هذه الفاتورة مستحقة الدفع خلال 30 يوماً من تاريخ الإصدار.</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}