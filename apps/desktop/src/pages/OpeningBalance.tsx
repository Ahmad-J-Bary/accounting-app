import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvoiceEditor } from "@/components/erp/InvoiceEditor";
import { invoiceService } from "@/services/invoiceService";
import { toast } from "sonner";
import { Plus, Save, History, CheckCircle2, Clock } from "lucide-react";
import type { InvoiceDto, InvoiceLineDto } from "@erp/shared-types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default function OpeningBalance() {
  const [lines, setLines] = useState<InvoiceLineDto[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState(`OPN-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    try {
      const data = await invoiceService.listInvoicesByType("OpeningBalance");
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSave = async () => {
    if (lines.length === 0) {
      toast.error("يجب إضافة مادة واحدة على الأقل");
      return;
    }

    try {
      setLoading(true);
      const request = {
        invoice_number: invoiceNumber,
        invoice_type: "OpeningBalance",
        lines,
        tax_amount: "0",
        discount_amount: "0",
        issued_at: new Date().toISOString(),
        notes,
      };

      const created = await invoiceService.createInvoice(request);
      // Automatically post opening balance as it's usually a one-time setup
      await invoiceService.postInvoice(created.id);
      
      toast.success("تم تسجيل المخزون الافتتاحي بنجاح");
      setLines([]);
      setInvoiceNumber(`OPN-${Date.now().toString().slice(-6)}`);
      setNotes("");
      fetchHistory();
    } catch (error) {
      toast.error("خطأ في العملية: " + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="فاتورة أول المدة"
        subtitle="تأسيس الرصيد الافتتاحي للمستودع والأسعار"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المخزن", to: "/inventory" }, { label: "أول المدة" }]}
        actions={
          <Button onClick={handleSave} disabled={loading} className="px-8">
            <Save className="w-4 h-4 ml-2" />
            {loading ? "جاري الحفظ..." : "حفظ وترحيل المخزون"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-right" dir="rtl">
              <div className="space-y-2">
                <Label>رقم القيد / الفاتورة</Label>
                <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات عامة</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="مثال: مخزون بداية العام 2024" />
              </div>
            </div>

            <InvoiceEditor 
              type="OpeningBalance" 
              lines={lines} 
              onChange={setLines} 
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 h-fit">
            <div className="flex items-center gap-2 mb-4 text-primary font-bold">
              <History className="w-5 h-5" />
              <h3 className="text-lg">العمليات السابقة</h3>
            </div>
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground bg-slate-50 rounded-lg border-dashed border-2">
                  لا توجد سجلات سابقة
                </div>
              ) : (
                history.map((inv) => (
                  <div key={inv.id} className="p-4 border rounded-lg hover:border-primary transition-colors bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-900">{inv.invoice_number}</span>
                      <Badge variant={inv.status === "Posted" ? "default" : "secondary"}>
                        {inv.status === "Posted" ? <CheckCircle2 className="w-3 h-3 ml-1" /> : <Clock className="w-3 h-3 ml-1" />}
                        {inv.status === "Posted" ? "مرحّل" : "مسودة"}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground mb-3">
                      <span>{formatDate(inv.issued_at)}</span>
                      <span className="font-mono">{inv.lines.length} مواد</span>
                    </div>
                    <div className="text-left font-black text-primary text-lg tabular-nums">
                      {formatCurrency(Number(inv.total_amount))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
