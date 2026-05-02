import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { PartnerCombobox } from "./shared/PartnerCombobox";
import { customerService } from "@/services/customerService";
import { materialService } from "@/services/materialService";
import { invoiceService } from "@/services/invoiceService";
import type { CustomerDto, MaterialDto, CreateInvoiceRequest, InvoiceLineDto, InvoiceDto } from "@erp/shared-types";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

interface NewInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  invoiceToEdit?: InvoiceDto | null;
}

function makeLine(): InvoiceLineDto {
  return { material_id: "", quantity: "1", unit_price: "0" };
}

export function NewInvoiceDialog({ open, onOpenChange, onSuccess, invoiceToEdit }: NewInvoiceDialogProps) {
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [products, setProducts] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<{ debit: string; credit: string } | null>(null);

  const [formData, setFormData] = useState<CreateInvoiceRequest>({
    invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    invoice_type: "Sales",
    issued_at: new Date().toISOString(),
    customer_id: "",
    lines: [],
    tax_amount: "0",
    discount_amount: "0",
    payment_method: "Cash",
    amount_paid: "0",
  });

  useEffect(() => {
    if (open) {
      if (invoiceToEdit) {
        setFormData({
          invoice_number: invoiceToEdit.invoice_number,
          invoice_type: "Sales",
          issued_at: invoiceToEdit.issued_at,
          customer_id: invoiceToEdit.customer_id ?? "",
          customer_name: invoiceToEdit.customer_name ?? "",
          lines: invoiceToEdit.lines.map(l => ({
            material_id: l.material_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
          tax_amount: invoiceToEdit.tax_amount,
          discount_amount: invoiceToEdit.discount_amount,
          payment_method: invoiceToEdit.payment_method || "Cash",
          amount_paid: invoiceToEdit.amount_paid || "0",
        });
      } else {
        setFormData({
          invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          invoice_type: "Sales",
          issued_at: new Date().toISOString(),
          customer_id: "",
          customer_name: "",
          lines: [],
          tax_amount: "0",
          discount_amount: "0",
          payment_method: "Cash",
          amount_paid: "0",
        });
      }
      loadData();
    }
  }, [open, invoiceToEdit]);

  const loadData = async () => {
    try {
      const [cData, pData] = await Promise.all([
        customerService.listCustomers(),
        materialService.listMaterials(),
      ]);
      setCustomers(cData);
      setProducts(pData);
    } catch (error) {
      console.error("Failed to load data for invoice:", error);
      toast.error("فشل تحميل البيانات الأساسية");
    }
  };

  const addLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, makeLine()]
    }));
  };

  const removeLine = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const updateLine = (index: number, field: keyof InvoiceLineDto, value: string) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    if (field === "material_id") {
      const product = products.find(p => p.id === value);
      if (product) {
        newLines[index].unit_price = product.last_sale_price || "0";
      }
    }
    setFormData(prev => ({ ...prev, lines: newLines }));
  };

  useEffect(() => {
    if (formData.customer_id && formData.customer_id.length > 20) { // Assuming UUID length
        const customer = customers.find(c => c.id === formData.customer_id);
        if (customer) {
            setCurrentBalance({ debit: customer.debit, credit: customer.credit });
        }
    } else {
        setCurrentBalance(null);
    }
  }, [formData.customer_id, customers]);

  const subtotal = formData.lines.reduce((sum, line) => {
    return sum + (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
  }, 0);
  const total = subtotal - parseFloat(formData.discount_amount || "0");
  const remainingAmount = total - (parseFloat(formData.amount_paid) || 0);

  useEffect(() => {
    if (formData.payment_method === "Cash") {
      setFormData(prev => ({ ...prev, amount_paid: total.toString() }));
    } else if (formData.payment_method === "Deferred") {
      setFormData(prev => ({ ...prev, amount_paid: "0" }));
    }
  }, [total, formData.payment_method]);

  const handleSubmit = async () => {
    if (formData.lines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }
    setLoading(true);
    try {
      await invoiceService.createInvoice({
        ...formData,
        customer_id: formData.customer_id || undefined,
        customer_name: !formData.customer_id ? formData.customer_name : undefined,
      });
      toast.success("تم إنشاء الفاتورة بنجاح");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create invoice:", error);
      toast.error("فشل إنشاء الفاتورة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-blue-900">إنشاء فاتورة مبيعات جديدة</DialogTitle>
          <DialogDescription>أدخل تفاصيل الفاتورة والأصناف المباعة.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 py-4" dir="rtl">
          {/* Right Sidebar: Partner & Summary */}
          <div className="w-80 shrink-0 space-y-6">
            <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50 shadow-sm border-slate-200">
                <div className="space-y-2">
                    <Label className="text-blue-900 font-bold">العميل</Label>
                    <PartnerCombobox
                    options={customers.map(c => ({ id: c.id, name: c.name }))}
                    value={formData.customer_id ?? ""}
                    onValueChange={val => {
                      const isExisting = customers.some(c => c.id === val);
                      setFormData(prev => ({ 
                        ...prev, 
                        customer_id: isExisting ? val : "",
                        customer_name: !isExisting ? val : ""
                      }));
                    }}
                    placeholder="اختر أو اكتب اسم زبون جديد"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-blue-900 font-bold">رقم الفاتورة</Label>
                    <Input
                    value={formData.invoice_number}
                    onChange={e => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                    className="font-mono"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-blue-900 font-bold">التاريخ</Label>
                    <Input
                    type="date"
                    value={formData.issued_at.split("T")[0]}
                    onChange={e => setFormData(prev => ({ ...prev, issued_at: new Date(e.target.value).toISOString() }))}
                    />
                </div>
            </div>

            {currentBalance && (
                <div className="p-5 border-2 border-blue-200 rounded-2xl bg-gradient-to-br from-blue-50 to-white shadow-md space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                        <h4 className="text-sm font-black text-blue-900">الموقف المالي للعميل</h4>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-500 font-bold">مدين (حالي)</span>
                            <span className="text-lg font-black text-destructive tabular-nums">{formatCurrency(parseFloat(currentBalance.debit))}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-500 font-bold">دائن (حالي)</span>
                            <span className="text-lg font-black text-green-700 tabular-nums">{formatCurrency(parseFloat(currentBalance.credit))}</span>
                        </div>
                        <div className="pt-3 border-t-2 border-dashed border-blue-100">
                            <div className="text-[10px] text-blue-600 font-black uppercase mb-1">المديونية الإجمالية المتوقعة</div>
                            <div className="text-3xl font-black text-blue-900 tabular-nums tracking-tighter">
                                {formatCurrency(parseFloat(currentBalance.debit) + remainingAmount)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50 shadow-sm border-slate-200">
                <div className="space-y-2">
                    <Label className="font-bold">طريقة الدفع</Label>
                    <Select
                    value={formData.payment_method}
                    onValueChange={val => setFormData(prev => ({ ...prev, payment_method: val }))}
                    >
                    <SelectTrigger className="font-bold">
                        <SelectValue placeholder="اختر طريقة الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Cash">نقدي</SelectItem>
                        <SelectItem value="Deferred">آجل</SelectItem>
                        <SelectItem value="Partial">دفع جزئي</SelectItem>
                    </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="font-bold">المبلغ المدفوع</Label>
                    <Input
                    type="number"
                    value={formData.amount_paid}
                    onChange={e => setFormData(prev => ({ ...prev, amount_paid: e.target.value }))}
                    disabled={formData.payment_method !== "Partial"}
                    className="tabular-nums font-black text-green-700 text-lg border-green-200 focus-visible:ring-green-500"
                    />
                </div>
            </div>
          </div>

          {/* Left Main Area: Items Table */}
          <div className="flex-1 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
                <h3 className="font-black text-xl text-slate-800">أصناف الفاتورة</h3>
                <Button onClick={addLine} size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 ml-2" />إضافة صنف</Button>
            </div>
            
            <div className="border rounded-xl overflow-hidden shadow-sm bg-white min-h-[400px]">
                <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                    <tr>
                    <th className="text-right px-4 py-3 font-bold text-slate-500">الصنف</th>
                    <th className="text-right px-4 py-3 w-24 font-bold text-slate-500">الكمية</th>
                    <th className="text-right px-4 py-3 w-32 font-bold text-slate-500">السعر</th>
                    <th className="text-right px-4 py-3 w-32 font-bold text-slate-500">الإجمالي</th>
                    <th className="w-10"></th>
                    </tr>
                </thead>
                <tbody>
                    {formData.lines.map((line, index) => (
                    <tr key={index} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="p-1">
                        <Select
                            value={line.material_id}
                            onValueChange={val => updateLine(index, "material_id", val)}
                        >
                            <SelectTrigger className="border-0 shadow-none focus:ring-0 font-bold">
                            <SelectValue placeholder="اختر المنتج" />
                            </SelectTrigger>
                            <SelectContent>
                            {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        </td>
                        <td className="p-1">
                        <Input
                            type="number" min="1" step="1"
                            value={line.quantity}
                            onChange={e => updateLine(index, "quantity", e.target.value)}
                            className="h-9 tabular-nums border-0 bg-transparent focus-visible:ring-0 text-center font-bold"
                        />
                        </td>
                        <td className="p-1">
                        <Input
                            type="number"
                            value={line.unit_price}
                            onChange={e => updateLine(index, "unit_price", e.target.value)}
                            className="h-9 tabular-nums border-0 bg-transparent focus-visible:ring-0 text-center font-bold"
                        />
                        </td>
                        <td className="p-4 text-left tabular-nums font-black text-slate-900">
                        {formatCurrency(parseFloat(line.quantity) * parseFloat(line.unit_price))}
                        </td>
                        <td className="p-1">
                        <Button variant="ghost" size="icon" onClick={() => removeLine(index)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>

            <div className="flex justify-between items-end p-6 border rounded-xl bg-slate-900 text-white">
                <div className="space-y-1">
                    <div className="text-xs opacity-60 font-bold uppercase tracking-widest">المجموع قبل الخصم</div>
                    <div className="text-xl font-bold tabular-nums opacity-80">{formatCurrency(subtotal)}</div>
                </div>

                <div className="space-y-1 text-center w-32">
                    <div className="text-xs opacity-60 font-bold">الخصم</div>
                    <Input
                        type="number"
                        value={formData.discount_amount}
                        onChange={e => setFormData(prev => ({ ...prev, discount_amount: e.target.value }))}
                        className="h-8 bg-white/10 border-white/20 text-white font-bold text-center"
                    />
                </div>

                <div className="space-y-0 text-left">
                    <div className="text-sm font-black text-blue-400 uppercase tracking-tighter">إجمالي الصافي المستحق</div>
                    <div className="text-5xl font-black tabular-nums tracking-tighter leading-none">{formatCurrency(total)}</div>
                </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "جاري الحفظ..." : "حفظ الفاتورة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
