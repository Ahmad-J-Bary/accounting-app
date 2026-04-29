import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
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

  const [formData, setFormData] = useState<CreateInvoiceRequest>({
    invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    invoice_type: "Sales",
    issued_at: new Date().toISOString(),
    customer_id: "",
    lines: [],
    tax_amount: "0",
    discount_amount: "0",
  });

  useEffect(() => {
    if (open) {
      if (invoiceToEdit) {
        setFormData({
          invoice_number: invoiceToEdit.invoice_number,
          invoice_type: "Sales",
          issued_at: invoiceToEdit.issued_at,
          customer_id: invoiceToEdit.customer_id ?? "",
          lines: invoiceToEdit.lines.map(l => ({
            material_id: l.material_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
          tax_amount: invoiceToEdit.tax_amount,
          discount_amount: invoiceToEdit.discount_amount,
        });
      } else {
        setFormData({
          invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          invoice_type: "Sales",
          issued_at: new Date().toISOString(),
          customer_id: "",
          lines: [],
          tax_amount: "0",
          discount_amount: "0",
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
        newLines[index].unit_price = product.purchase_price || "0";
      }
    }
    setFormData(prev => ({ ...prev, lines: newLines }));
  };

  const subtotal = formData.lines.reduce((sum, line) => {
    return sum + (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
  }, 0);
  const total = subtotal - parseFloat(formData.discount_amount || "0");

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
              value={formData.customer_id ?? ""}
              onValueChange={val => setFormData(prev => ({ ...prev, customer_id: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="زبون نقدي (اختياري)" />
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
            <Input
              type="date"
              value={formData.issued_at.split("T")[0]}
              onChange={e => setFormData(prev => ({ ...prev, issued_at: new Date(e.target.value).toISOString() }))}
            />
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
                        value={line.material_id}
                        onValueChange={val => updateLine(index, "material_id", val)}
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
                        type="number" min="1" step="1"
                        value={line.quantity}
                        onChange={e => updateLine(index, "quantity", e.target.value)}
                        className="h-8 tabular-nums"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={line.unit_price}
                        onChange={e => updateLine(index, "unit_price", e.target.value)}
                        className="h-8 tabular-nums"
                      />
                    </td>
                    <td className="p-2 text-left tabular-nums font-medium">
                      {formatCurrency(parseFloat(line.quantity) * parseFloat(line.unit_price))}
                    </td>
                    <td className="p-2">
                      <Button variant="ghost" size="icon" onClick={() => removeLine(index)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {formData.lines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      لا توجد أصناف مضافة. انقر على "إضافة صنف" للبدء.
                    </td>
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
