import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { PartnerCombobox } from "./shared/PartnerCombobox";
import { supplierService } from "@/services/supplierService";
import { materialService } from "@/services/materialService";
import { purchaseService } from "@/services/purchaseService";
import type { SupplierDto, MaterialDto, CreatePurchaseInvoiceRequest, CreatePurchaseInvoiceItemRequest, PurchaseInvoice } from "@erp/shared-types";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

interface NewPurchaseInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  invoiceToEdit?: PurchaseInvoice | null;
}

export function NewPurchaseInvoiceDialog({ open, onOpenChange, onSuccess, invoiceToEdit }: NewPurchaseInvoiceDialogProps) {
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [products, setProducts] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<{ debit: string; credit: string } | null>(null);

  const [formData, setFormData] = useState<{
    invoice_number: string;
    supplier_id: string;
    supplier_name: string;
    items: { product_id: string; quantity: string; unit_price: string; notes?: string }[];
    tax_amount: string;
    discount_amount: string;
    invoice_date: string;
    payment_method: string;
    amount_paid: string;
    notes: string;
  }>({
    invoice_number: `PUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    supplier_id: "",
    supplier_name: "",
    items: [],
    tax_amount: "0",
    discount_amount: "0",
    invoice_date: new Date().toISOString().split('T')[0],
    payment_method: "Cash",
    amount_paid: "0",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      if (invoiceToEdit) {
        setFormData({
          invoice_number: invoiceToEdit.invoice_number,
          supplier_id: invoiceToEdit.supplier_id,
          supplier_name: invoiceToEdit.supplier_name || "",
          items: invoiceToEdit.items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            notes: i.notes
          })),
          tax_amount: invoiceToEdit.tax_amount,
          discount_amount: invoiceToEdit.discount_amount,
          invoice_date: invoiceToEdit.invoice_date.split('T')[0],
          payment_method: "Cash", // Default or extract if available
          amount_paid: "0",
          notes: invoiceToEdit.notes || "",
        });
      } else {
        setFormData({
          invoice_number: `PUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          supplier_id: "",
          supplier_name: "",
          items: [],
          tax_amount: "0",
          discount_amount: "0",
          invoice_date: new Date().toISOString().split('T')[0],
          payment_method: "Cash",
          amount_paid: "0",
          notes: "",
        });
      }
      loadData();
    }
  }, [open, invoiceToEdit]);

  const loadData = async () => {
    try {
      const [sData, pData] = await Promise.all([
        supplierService.listSuppliers(),
        materialService.listMaterials(),
      ]);
      setSuppliers(sData);
      setProducts(pData);
    } catch (error) {
      console.error("Failed to load data for purchase invoice:", error);
      toast.error("فشل تحميل البيانات الأساسية");
    }
  };

  useEffect(() => {
    if (formData.supplier_id && formData.supplier_id.length > 20) {
        const supplier = suppliers.find(s => s.id === formData.supplier_id);
        if (supplier) {
            setCurrentBalance({ debit: supplier.debit, credit: supplier.credit });
        }
    } else {
        setCurrentBalance(null);
    }
  }, [formData.supplier_id, suppliers]);

  const addLine = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: "", quantity: "1", unit_price: "0" }]
    }));
  };

  const removeLine = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateLine = (index: number, field: string, value: string) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].unit_price = product.last_purchase_price || "0";
      }
    }
    
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const subtotal = formData.items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  }, 0);
  const calculatedTax = subtotal * 0; // Simplified tax for now
  const total = subtotal + calculatedTax - parseFloat(formData.discount_amount || "0");
  const remainingAmount = total - (parseFloat(formData.amount_paid) || 0);

  useEffect(() => {
    if (formData.payment_method === "Cash") {
      setFormData(prev => ({ ...prev, amount_paid: total.toString() }));
    } else if (formData.payment_method === "Deferred") {
      setFormData(prev => ({ ...prev, amount_paid: "0" }));
    }
  }, [total, formData.payment_method]);

  const handleSubmit = async () => {
    if (!formData.supplier_id) {
      toast.error("يرجى اختيار المورد");
      return;
    }
    if (formData.items.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }

    setLoading(true);
    try {
      const request: CreatePurchaseInvoiceRequest = {
        invoice_number: formData.invoice_number,
        supplier_id: formData.supplier_id || undefined,
        supplier_name: !formData.supplier_id ? formData.supplier_name : undefined,
        items: formData.items.map(item => ({
          product_id: item.product_id,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          notes: item.notes,
        })),
        tax_amount: calculatedTax,
        discount_amount: parseFloat(formData.discount_amount),
        payment_method: formData.payment_method as "Cash" | "Deferred" | "Partial",
        amount_paid: formData.payment_method === "cash" ? total.toString() : (formData.payment_method === "partial" ? formData.amount_paid.toString() : "0"),
        invoice_date: new Date(formData.invoice_date).toISOString(),
        notes: formData.notes,
      };

      await purchaseService.createPurchaseInvoice(request);
      toast.success("تم إنشاء فاتورة المشتريات بنجاح");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create purchase invoice:", error);
      toast.error("فشل إنشاء الفاتورة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl">
        <DialogHeader className="p-6 bg-slate-900 text-white rounded-t-xl">
          <DialogTitle className="text-2xl font-black">إنشاء فاتورة مشتريات جديدة</DialogTitle>
          <DialogDescription className="text-slate-400">أدخل تفاصيل فاتورة الشراء من المورد والأصناف.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 p-6" dir="rtl">
          <div className="w-80 shrink-0 space-y-6">
            <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50 shadow-sm border-slate-200">
                <div className="space-y-2">
                    <Label className="text-green-900 font-bold">المورد</Label>
                    <PartnerCombobox
                    options={suppliers.map(s => ({ id: s.id, name: s.name }))}
                    value={formData.supplier_id ?? ""}
                    onValueChange={val => {
                        const isExisting = suppliers.some(s => s.id === val);
                        setFormData(prev => ({ 
                            ...prev, 
                            supplier_id: isExisting ? val : "",
                            supplier_name: !isExisting ? val : ""
                        }));
                    }}
                    placeholder="اختر أو اكتب اسم مورد جديد"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-green-900 font-bold">رقم الفاتورة</Label>
                    <Input 
                    value={formData.invoice_number} 
                    onChange={e => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                    className="font-mono"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-green-900 font-bold">التاريخ</Label>
                    <Input 
                    type="date" 
                    value={formData.invoice_date}
                    onChange={e => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
                    />
                </div>
            </div>

            {currentBalance && (
                <div className="p-5 border-2 border-green-200 rounded-2xl bg-gradient-to-br from-green-50 to-white shadow-md space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-green-100 pb-2">
                        <h4 className="text-sm font-black text-green-900">الموقف المالي للمورد</h4>
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
                        <div className="pt-3 border-t-2 border-dashed border-green-100">
                            <div className="text-[10px] text-green-600 font-black uppercase mb-1">الاستحقاق الإجمالي للمورد</div>
                            <div className="text-3xl font-black text-green-900 tabular-nums tracking-tighter">
                                {formatCurrency(parseFloat(currentBalance.credit) + remainingAmount)}
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

          <div className="flex-1 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
                <h3 className="font-black text-xl text-slate-800">أصناف الفاتورة</h3>
                <Button onClick={addLine} size="sm" className="bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4 ml-2" />إضافة صنف</Button>
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
                    {formData.items.map((item, index) => (
                    <tr key={index} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="p-1">
                        <Select
                            value={item.product_id}
                            onValueChange={val => updateLine(index, "product_id", val)}
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
                            value={item.quantity}
                            onChange={e => updateLine(index, "quantity", e.target.value)}
                            className="h-9 tabular-nums border-0 bg-transparent focus-visible:ring-0 text-center font-bold"
                        />
                        </td>
                        <td className="p-1">
                        <Input
                            type="number"
                            value={item.unit_price}
                            onChange={e => updateLine(index, "unit_price", e.target.value)}
                            className="h-9 tabular-nums border-0 bg-transparent focus-visible:ring-0 text-center font-bold"
                        />
                        </td>
                        <td className="p-4 text-left tabular-nums font-black text-slate-900">
                        {formatCurrency(parseFloat(item.quantity) * parseFloat(item.unit_price))}
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
                    <div className="text-sm font-black text-green-400 uppercase tracking-tighter">إجمالي الصافي المستحق</div>
                    <div className="text-5xl font-black tabular-nums tracking-tighter leading-none">{formatCurrency(total)}</div>
                </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={loading} className="mr-2">
            {loading ? "جاري الحفظ..." : "حفظ الفاتورة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
