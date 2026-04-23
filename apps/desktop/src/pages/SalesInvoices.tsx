import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, MoreHorizontal, Eye, Edit, Printer, Send, FileText, Trash2, RefreshCw } from "lucide-react";
import { products } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { invoiceService } from "@/services/invoiceService";
import type { InvoiceDto } from "@erp/shared-types";
import { NewInvoiceDialog } from "@/components/erp/NewInvoiceDialog";

export default function SalesInvoices() {
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const selectedInv = invoices.find(i => i.id === preview);

  useEffect(() => {
    loadInvoices();

    const handleOpenDialog = () => setIsNewInvoiceOpen(true);
    window.addEventListener("erp:open-new-invoice", handleOpenDialog);
    return () => window.removeEventListener("erp:open-new-invoice", handleOpenDialog);
  }, []);

  const postInvoice = async (id: string) => {
    try {
      setLoading(true);
      await invoiceService.postInvoice(id);
      await loadInvoices();
    } catch (error) {
      console.error('Failed to post invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const data = await invoiceService.listInvoices();
      setInvoices(data);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="فواتير المبيعات"
        subtitle="إدارة فواتير المبيعات والمتابعة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المبيعات" }, { label: "الفواتير" }]}
        actions={
          <div className="flex items-center gap-2 relative z-[100]">
            <Button variant="outline" onClick={loadInvoices} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button onClick={() => setIsNewInvoiceOpen(true)}>
              <Plus className="w-4 h-4 ml-2" />فاتورة جديدة
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي الفواتير</div><div className="text-2xl font-bold tabular-nums mt-1">{invoices.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">مرحّلة</div><div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{invoices.filter(i => i.posted).length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">مسودة</div><div className="text-2xl font-bold text-amber-600 tabular-nums mt-1">{invoices.filter(i => !i.posted).length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي المبيعات</div><div className="text-xl font-bold text-primary tabular-nums mt-1">{formatCurrency(invoices.reduce((s, i) => s + parseFloat(i.total), 0))}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي الضريبة</div><div className="text-xl font-bold text-slate-700 tabular-nums mt-1">{formatCurrency(invoices.reduce((s, i) => s + parseFloat(i.tax_amount), 0))}</div></Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث برقم الفاتورة أو العميل..." className="pr-10" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفواتير</SelectItem>
              <SelectItem value="posted">مرحّلة</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">رقم الفاتورة</th>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium">العميل</th>
                  <th className="text-left px-4 py-3 font-medium">الإجمالي</th>
                  <th className="text-left px-4 py-3 font-medium">الضريبة</th>
                  <th className="text-left px-4 py-3 font-medium">الحالة</th>
                  <th className="text-left px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium cursor-pointer" onClick={() => setPreview(inv.id)}>{inv.invoice_number}</td>
                    <td className="px-4 py-3">{formatDate(inv.issued_at)}</td>
                    <td className="px-4 py-3 font-medium">{inv.customer_name || inv.customer_id.substring(0, 8) + "..."}</td>
                    <td className="px-4 py-3 text-left tabular-nums font-medium">{formatCurrency(parseFloat(inv.total))}</td>
                    <td className="px-4 py-3 text-left tabular-nums text-slate-500">{formatCurrency(parseFloat(inv.tax_amount))}</td>
                    <td className="px-4 py-3 text-left">
                      <StatusBadge status={inv.posted ? "posted" : "draft"} />
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           <DropdownMenuItem onClick={() => setPreview(inv.id)}><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                           {!inv.posted && (
                             <>
                               <DropdownMenuItem><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                               <DropdownMenuItem onClick={() => postInvoice(inv.id)} className="text-green-600">
                                 <Send className="w-4 h-4 ml-2" />ترحيل
                               </DropdownMenuItem>
                             </>
                           )}
                           <DropdownMenuItem><Printer className="w-4 h-4 ml-2" />طباعة</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="w-4 h-4 ml-2" />حذف</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">لا توجد فواتير مبيعات حتى الآن.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewInvoiceDialog 
        open={isNewInvoiceOpen} 
        onOpenChange={setIsNewInvoiceOpen}
        onSuccess={loadInvoices}
      />

      {/* Invoice preview dialog - printable */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
             <DialogTitle className="flex items-center justify-between">
               <span>معاينة الفاتورة</span>
               <div className="flex gap-2">
                 {selectedInv && !selectedInv.posted && (
                   <Button size="sm" variant="default" onClick={() => { postInvoice(selectedInv.id); setPreview(null); }} className="bg-green-600 hover:bg-green-700">
                     <Send className="w-4 h-4 ml-2" />ترحيل الفاتورة
                   </Button>
                 )}
                 <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-2" />طباعة</Button>
               </div>
             </DialogTitle>
            <DialogDescription>عرض تفاصيل الفاتورة الضريبية وجدول الأصناف.</DialogDescription>
          </DialogHeader>
          {selectedInv && (
            <div className="print-area bg-white border border-border rounded-md p-8">
              <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-primary">
                <div>
                  <h2 className="text-2xl font-bold text-primary">فاتورة ضريبية</h2>
                  <p className="text-sm text-muted-foreground mt-1">Tax Invoice</p>
                </div>
                <div className="text-left" dir="rtl">
                  <div className="font-bold text-lg">شركة بردى للصناعة</div>
                  <div className="text-xs text-muted-foreground">الرقم الضريبي: 011-234567-001</div>
                  <div className="text-xs text-muted-foreground">دمشق، الجمهورية العربية السورية</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6" dir="rtl">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">فاتورة إلى</div>
                  <div className="font-bold">{selectedInv.customer_name || selectedInv.customer_id}</div>
                  <div className="text-sm text-muted-foreground">دمشق، الجمهورية العربية السورية</div>
                </div>
                <div className="space-y-1 text-sm text-left">
                  <div className="flex justify-between"><span className="text-muted-foreground">رقم الفاتورة:</span><span className="font-medium">{selectedInv.invoice_number}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">التاريخ:</span><span>{formatDate(selectedInv.issued_at)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الحالة:</span><span>{selectedInv.posted ? "مرحّلة" : "مسودة"}</span></div>
                </div>
              </div>

              <table className="w-full text-sm mb-6 border border-border" dir="rtl">
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
                  {selectedInv.lines.map((line, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2">{line.product_name || line.product_id}</td>
                      <td className="px-3 py-2 text-left tabular-nums">{line.quantity}</td>
                      <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(parseFloat(line.unit_price))}</td>
                      <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(parseFloat(line.quantity) * parseFloat(line.unit_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-start mb-6" dir="rtl">
                <div className="w-72 space-y-1 text-sm mr-auto">
                   <div className="flex justify-between"><span className="text-muted-foreground">المجموع الفرعي:</span><span className="tabular-nums">{formatCurrency(parseFloat(selectedInv.subtotal))}</span></div>
                   <div className="flex justify-between"><span className="text-muted-foreground">الضريبة:</span><span className="tabular-nums">{formatCurrency(parseFloat(selectedInv.tax_amount))}</span></div>
                   <div className="flex justify-between"><span className="text-muted-foreground">الخصم:</span><span className="tabular-nums">{formatCurrency(parseFloat(selectedInv.discount_amount))}</span></div>
                   <div className="flex justify-between py-2 border-t-2 border-primary font-bold text-base mt-2"><span>الإجمالي العام</span><span className="tabular-nums">{formatCurrency(parseFloat(selectedInv.total))}</span></div>
                </div>
              </div>

              <div className="border-t border-border pt-4 text-xs text-muted-foreground text-right" dir="rtl">
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