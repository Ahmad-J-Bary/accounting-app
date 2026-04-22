import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Calculator } from "lucide-react";
import { customerService } from "@/services/customerService";
import { productService } from "@/services/productService";
import { invoiceService } from "@/services/invoiceService";
import type { CustomerDto, ProductDto, CreateInvoiceRequest, InvoiceLineDto } from "@erp/shared-types";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner"; // Assuming sonner is used

interface NewInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewInvoiceDialog({ open, onOpenChange, onSuccess }: NewInvoiceDialogProps) {
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<CreateInvoiceRequest>({
    invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    customer_id: "",
    lines: [],
    tax_amount: "0",
    discount_amount: "0",
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      const [cData, pData] = await Promise.all([
        customerService.listCustomers(),
        productService.listProducts(),
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
      lines: [...prev.lines, { product_id: "", quantity: "1", unit_price: "0" }]
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
    
    // If product changed, update price automatically
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        newLines[index].unit_price = product.unit_price;
      }
    }
    
    setFormData(prev => ({ ...prev, lines: newLines }));
  };

  const calculateSubtotal = () => {
    return formData.lines.reduce((sum, line) => {
      const q = parseFloat(line.quantity) || 0;
      const p = parseFloat(line.unit_price) || 0;
      return sum + (q * p);
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const taxRate = 0.0; // Default tax rate for Syria (consumption tax or other)
  const calculatedTax = subtotal * taxRate;
  const total = subtotal + calculatedTax - parseFloat(formData.discount_amount || "0");

  const handleSubmit = async () => {
    if (!formData.customer_id) {
      toast.error("يرجى اختيار العميل");
      return;
    }
    if (formData.lines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }

    setLoading(true);
    try {
      await invoiceService.createInvoice({
        ...formData,
        tax_amount: calculatedTax.toFixed(2),
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إنشاء فاتورة مبيعات جديدة</DialogTitle>
          <DialogDescription>أدخل تفاصيل الفاتورة والأصناف المباعة.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
          <div className="space-y-2">
            <Label>رقم الفاتورة</Label>
            <Input 
              value={formData.invoice_number} 
              onChange={e => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
              placeholder="مثال: INV-2024-001"
            />
          </div>

          <div className="space-y-2">
            <Label>العميل</Label>
            <Select 
              value={formData.customer_id} 
              onValueChange={val => setFormData(prev => ({ ...prev, customer_id: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر العميل" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">الأصناف</h3>
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
                {formData.lines.map((line, index) => (
                  <tr key={index} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-2">
                      <Select 
                        value={line.product_id} 
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
                        value={line.quantity} 
                        onChange={e => updateLine(index, 'quantity', e.target.value)}
                        className="h-8 tabular-nums"
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number" 
                        value={line.unit_price} 
                        onChange={e => updateLine(index, 'unit_price', e.target.value)}
                        className="h-8 tabular-nums"
                      />
                    </td>
                    <td className="p-2 text-left tabular-nums font-medium">
                      {formatCurrency(parseFloat(line.quantity) * parseFloat(line.unit_price))}
                    </td>
                    <td className="p-2">
                      <Button variant="ghost" size="icon" onClick={() => removeLine(index)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {formData.lines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد أصناف مضافة. انقر على "إضافة صنف" للبدء.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-2 pt-4">
          <div className="grid grid-cols-2 w-64 text-sm gap-2">
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
