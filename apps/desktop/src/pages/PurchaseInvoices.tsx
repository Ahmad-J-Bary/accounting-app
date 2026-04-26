import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Printer, 
  Send, 
  Trash2, 
  RefreshCw,
  Save,
  Truck
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoiceService } from "@/services/invoiceService";
import { supplierService } from "@/services/supplierService";
import type { InvoiceDto, InvoiceLineDto, SupplierDto } from "@erp/shared-types";
import { toast } from "sonner";
import { InvoiceEditor } from "@/components/erp/InvoiceEditor";
import { Label } from "@/components/ui/label";

export default function PurchaseInvoices() {
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Partial<InvoiceDto> | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, suppData] = await Promise.all([
        invoiceService.listInvoicesByType("Purchase"),
        supplierService.listSuppliers()
      ]);
      setInvoices(invData);
      setSuppliers(suppData);
    } catch (error) {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = () => {
    setCurrentInvoice({
      invoice_number: `PUR-${Date.now().toString().slice(-6)}`,
      invoice_type: "Purchase",
      lines: [],
      tax_amount: "0",
      discount_amount: "0",
      issued_at: new Date().toISOString(),
      status: "Draft"
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!currentInvoice?.supplier_id) {
      toast.error("يجب تحديد المورد");
      return;
    }
    if (!currentInvoice.lines || currentInvoice.lines.length === 0) {
      toast.error("يجب إضافة مادة واحدة على الأقل");
      return;
    }

    try {
      setLoading(true);
      const request = {
        invoice_number: currentInvoice.invoice_number!,
        invoice_type: "Purchase",
        supplier_id: currentInvoice.supplier_id,
        lines: currentInvoice.lines as InvoiceLineDto[],
        tax_amount: currentInvoice.tax_amount || "0",
        discount_amount: currentInvoice.discount_amount || "0",
        issued_at: currentInvoice.issued_at || new Date().toISOString(),
        notes: currentInvoice.notes,
      };

      await invoiceService.createInvoice(request);
      toast.success("تم حفظ فاتورة المشتريات بنجاح");
      setIsEditing(false);
      loadData();
    } catch (error) {
      toast.error("خطأ في الحفظ: " + error);
    } finally {
      setLoading(false);
    }
  };

  const postInvoice = async (id: string) => {
    try {
      setLoading(true);
      await invoiceService.postInvoice(id);
      toast.success("تم ترحيل الفاتورة بنجاح");
      loadData();
    } catch (error) {
      toast.error("فشل الترحيل: " + error);
    } finally {
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-6 pb-20">
        <PageHeader
          title={currentInvoice?.id ? "تعديل فاتورة مشتريات" : "فاتورة مشتريات جديدة"}
          subtitle="إدخال مشتريات المواد وتحديث تكاليف المخزون"
          breadcrumbs={[{ label: "الفواتير", onClick: () => setIsEditing(false) }, { label: "تحرير" }]}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={loading}>
                <Save className="w-4 h-4 ml-2" />
                {loading ? "جاري الحفظ..." : "حفظ الفاتورة"}
              </Button>
            </div>
          }
        />

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-right" dir="rtl">
            <div className="space-y-2">
              <Label>رقم الفاتورة</Label>
              <Input 
                value={currentInvoice?.invoice_number} 
                onChange={e => setCurrentInvoice({...currentInvoice, invoice_number: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>المورد *</Label>
              <Select 
                value={currentInvoice?.supplier_id} 
                onValueChange={val => setCurrentInvoice({...currentInvoice, supplier_id: val})}
              >
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="اختر المورد..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input 
                type="date" 
                value={currentInvoice?.issued_at?.split('T')[0]} 
                onChange={e => setCurrentInvoice({...currentInvoice, issued_at: new Date(e.target.value).toISOString()})} 
              />
            </div>
          </div>

          <InvoiceEditor 
            type="Purchase" 
            lines={currentInvoice?.lines as InvoiceLineDto[] || []} 
            onChange={lines => setCurrentInvoice({...currentInvoice, lines})} 
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 border-t pt-6" dir="rtl">
             <div className="space-y-4">
                <div className="space-y-2 text-right">
                  <Label>ملاحظات</Label>
                  <Input 
                    value={currentInvoice?.notes || ""} 
                    onChange={e => setCurrentInvoice({...currentInvoice, notes: e.target.value})} 
                    placeholder="ملاحظات الشراء..."
                  />
                </div>
             </div>
             <div className="bg-slate-50 p-6 rounded-lg space-y-3">
                <div className="flex justify-between items-center pt-3 border-t-2 border-primary">
                  <span className="font-black text-lg">إجمالي الشراء:</span>
                  <span className="font-black text-2xl text-primary tabular-nums">
                    {formatCurrency(
                      (currentInvoice?.lines as InvoiceLineDto[] || []).reduce((s, l) => s + (Number(l.quantity) * Number(l.unit_price)), 0) + 
                      Number(currentInvoice?.tax_amount || 0) - 
                      Number(currentInvoice?.discount_amount || 0)
                    )}
                  </span>
                </div>
             </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="فواتير المشتريات"
        subtitle="إدارة عمليات الشراء من الموردين"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المشتريات" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 ml-2" />فاتورة شراء جديدة
            </Button>
          </div>
        }
      />

      <Card className="p-5">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto text-right" dir="rtl">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-medium text-right">رقم الفاتورة</th>
                  <th className="px-4 py-3 font-medium text-right">التاريخ</th>
                  <th className="px-4 py-3 font-medium text-right">المورد</th>
                  <th className="px-4 py-3 font-medium text-left">الإجمالي</th>
                  <th className="px-4 py-3 font-medium text-right">الحالة</th>
                  <th className="px-4 py-3 font-medium w-12 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-primary">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issued_at)}</td>
                    <td className="px-4 py-3 font-medium">{inv.supplier_name || "مورد غير معروف"}</td>
                    <td className="px-4 py-3 text-left tabular-nums font-black">{formatCurrency(Number(inv.total_amount))}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status.toLowerCase()} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                           <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض التفاصيل</DropdownMenuItem>
                           {inv.status === "Draft" && (
                             <>
                               <DropdownMenuItem onClick={() => { setCurrentInvoice(inv); setIsEditing(true); }}>
                                 <Edit className="w-4 h-4 ml-2" />تعديل
                               </DropdownMenuItem>
                               <DropdownMenuItem onClick={() => postInvoice(inv.id)} className="text-green-600">
                                 <Send className="w-4 h-4 ml-2" />ترحيل الفاتورة
                               </DropdownMenuItem>
                             </>
                           )}
                           <DropdownMenuItem><Printer className="w-4 h-4 ml-2" />طباعة</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">لا توجد فواتير مشتريات حتى الآن.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}