import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { supplierService } from "@/services/supplierService";
import { productService } from "@/services/productService";
import { purchaseService } from "@/services/purchaseService";
import type { SupplierDto, ProductDto, CreatePurchaseInvoiceRequest, CreatePurchaseInvoiceItemRequest } from "@erp/shared-types";
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
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<{
    invoice_number: string;
    supplier_id: string;
    items: { product_id: string; quantity: string; unit_price: string; notes?: string }[];
    tax_amount: string;
    discount_amount: string;
    invoice_date: string;
    notes: string;
  }>({
    invoice_number: `PUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    supplier_id: "",
    items: [],
    tax_amount: "0",
    discount_amount: "0",
    invoice_date: new Date().toISOString().split('T')[0],
    notes: "",
  });

  useEffect(() => {
    if (open) {
      if (invoiceToEdit) {
        setFormData({
          invoice_number: invoiceToEdit.invoice_number,
          supplier_id: invoiceToEdit.supplier_id,
          items: invoiceToEdit.items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            notes: i.notes
          })),
          tax_amount: invoiceToEdit.tax_amount,
          discount_amount: invoiceToEdit.discount_amount,
          invoice_date: invoiceToEdit.invoice_date.split('T')[0],
          notes: invoiceToEdit.notes || "",
        });
      } else {
        setFormData({
          invoice_number: `PUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          supplier_id: "",
          items: [],
          tax_amount: "0",
          discount_amount: "0",
          invoice_date: new Date().toISOString().split('T')[0],
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
        productService.listProducts(),
      ]);
      setSuppliers(sData);
      setProducts(pData);
    } catch (error) {
      console.error("Failed to load data for purchase invoice:", error);
      toast.error("فشل تحميل البيانات الأساسية");
    }
  };

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
        newItems[index].unit_price = product.purchase_price || "0";
      }
    }
    
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.unit_price) || 0;
      return sum + (q * p);
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const taxRate = 0.0; // Localized for Syria
  const calculatedTax = subtotal * taxRate;
  const total = subtotal + calculatedTax - parseFloat(formData.discount_amount || "0");

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
        supplier_id: formData.supplier_id,
        items: formData.items.map(item => ({
          product_id: item.product_id,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          notes: item.notes,
        })),
        tax_amount: calculatedTax,
        discount_amount: parseFloat(formData.discount_amount),
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إنشاء فاتورة مشتريات جديدة</DialogTitle>
          <DialogDescription>أدخل تفاصيل فاتورة الشراء من المورد والأصناف.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 text-right" dir="rtl">
          <div className="space-y-2">
            <Label>رقم الفاتورة</Label>
            <Input 
              value={formData.invoice_number} 
              onChange={e => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>المورد</Label>
            <Select 
              value={formData.supplier_id} 
              onValueChange={val => setFormData(prev => ({ ...prev, supplier_id: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المورد" />
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
              value={formData.invoice_date}
              onChange={e => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-4" dir="rtl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">الأصناف المشتراة</h3>
            <Button size="sm" onClick={addLine}><Plus className="w-4 h-4 ml-2" />إضافة صنف</Button>
          </div>

          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-right px-4 py-2">الصنف</th>
                  <th className="text-right px-4 py-2 w-24">الكمية</th>
                  <th className="text-right px-4 py-2 w-32">السعر</th>
                  <th className="text-right px-4 py-2 w-32">الإجمالي</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, index) => (
                  <tr key={index} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-2">
                      <Select 
                        value={item.product_id} 
                        onValueChange={val => updateLine(index, 'product_id', val)}
                      >
                        <SelectTrigger className="border-0 shadow-none focus:ring-0">
                          <SelectValue placeholder="اختر المنتج" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number" 
                        min="1"
                        step="1"
                        value={item.quantity} 
                        onChange={e => updateLine(index, 'quantity', e.target.value)}
                        className="h-8 tabular-nums"
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number" 
                        value={item.unit_price} 
                        onChange={e => updateLine(index, 'unit_price', e.target.value)}
                        className="h-8 tabular-nums"
                      />
                    </td>
                    <td className="p-2 text-left tabular-nums font-medium">
                      {formatCurrency(parseFloat(item.quantity) * parseFloat(item.unit_price))}
                    </td>
                    <td className="p-2 text-center">
                      <Button variant="ghost" size="icon" onClick={() => removeLine(index)} className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col items-start space-y-2 pt-4" dir="rtl">
           <div className="grid grid-cols-2 w-64 text-sm gap-2 mr-auto">
            <span className="text-muted-foreground">المجموع الفرعي:</span>
            <span className="text-left tabular-nums font-medium">{formatCurrency(subtotal)}</span>
            
            <span className="text-muted-foreground">الضريبة:</span>
            <span className="text-left tabular-nums font-medium">{formatCurrency(calculatedTax)}</span>
            
            <span className="text-muted-foreground self-center">الخصم:</span>
            <Input 
              type="number" 
              value={formData.discount_amount} 
              onChange={e => setFormData(prev => ({ ...prev, discount_amount: e.target.value }))}
              className="h-7 text-left tabular-nums"
            />
            
            <div className="col-span-2 border-t pt-2 mt-1 flex justify-between font-bold text-lg text-primary">
              <span>الإجمالي العام:</span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0" dir="rtl">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={loading} className="mr-2">
            {loading ? "جاري الحفظ..." : "حفظ الفاتورة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
