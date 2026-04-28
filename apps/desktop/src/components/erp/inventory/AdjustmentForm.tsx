import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import type { CreateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";

interface AdjustmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: MaterialDto[];
  onSave: (payload: CreateStockAdjustmentRequest) => Promise<void>;
  saving: boolean;
}

export function AdjustmentForm({ open, onOpenChange, products, onSave, saving }: AdjustmentFormProps) {
  const [form, setForm] = useState<Partial<CreateStockAdjustmentRequest>>({
    adjustment_date: new Date().toISOString(),
    actual_quantity: 0,
    product_id: "",
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm({ adjustment_date: new Date().toISOString(), actual_quantity: 0, product_id: "" });
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!form.product_id || form.actual_quantity === undefined || !form.adjustment_date) return;
    await onSave(form as CreateStockAdjustmentRequest);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسوية جرد جديدة</DialogTitle>
          <DialogDescription>تحديث كمية المخزون الفعلي لتتناسب مع الكمية الموجودة في المستودع.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>المنتج *</Label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={form.product_id ?? ""} 
              onChange={e => setForm(p => ({ ...p, product_id: e.target.value }))}
            >
              <option value="">اختر المنتج...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>الكمية الفعلية المعدودة *</Label>
            <Input type="number" min="0" step="1"
              value={form.actual_quantity ?? ""}
              onChange={e => setForm(p => ({ ...p, actual_quantity: parseFloat(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label>سبب التسوية</Label>
            <Input value={form.reason ?? ""} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="جرد دوري، خطأ إدخال..." />
          </div>
          <div className="space-y-1">
            <Label>تاريخ التسوية</Label>
            <Input type="date"
              value={form.adjustment_date?.slice(0, 10) ?? ""}
              onChange={e => setForm(p => ({ ...p, adjustment_date: new Date(e.target.value).toISOString() }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || !form.product_id || form.actual_quantity === undefined || form.actual_quantity === null}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
