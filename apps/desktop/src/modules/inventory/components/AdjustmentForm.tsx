import { useState, useEffect } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { CreateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { DialogForm } from "@widgets/sidebar-shell/DialogForm";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";

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

  useEffect(() => {
    if (open) {
      setForm({ adjustment_date: new Date().toISOString(), actual_quantity: 0, product_id: "" });
    }
  }, [open]);

  const handleSave = async () => {
    if (!form.product_id || form.actual_quantity === undefined || !form.adjustment_date) return;
    await onSave(form as CreateStockAdjustmentRequest);
  };

  return (
    <DialogForm
      open={open}
      onOpenChange={onOpenChange}
      title="تسوية جرد جديدة"
      description="تحديث كمية المخزون الفعلي لتتناسب مع الكمية الموجودة في المستودع."
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={!form.product_id || form.actual_quantity === undefined || form.actual_quantity === null}
    >
      <SidebarSection title="بيانات التسوية">
        <div className="space-y-2">
          <FieldLabel required>المنتج</FieldLabel>
          <Select value={form.product_id ?? ""} onValueChange={val => setForm(p => ({ ...p, product_id: val }))}>
            <SelectTrigger><SelectValue placeholder="اختر المنتج..." /></SelectTrigger>
            <SelectContent>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <FieldLabel required>الكمية الفعلية المعدودة</FieldLabel>
          <Input type="number" min="0" step="1"
            value={form.actual_quantity ?? ""}
            onChange={e => setForm(p => ({ ...p, actual_quantity: parseFloat(e.target.value) }))} />
        </div>
        <div className="space-y-2">
          <FieldLabel>سبب التسوية</FieldLabel>
          <Input value={form.reason ?? ""} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="جرد دوري، خطأ إدخال..." />
        </div>
        <div className="space-y-2">
          <FieldLabel>تاريخ التسوية</FieldLabel>
          <Input type="date"
            value={form.adjustment_date?.slice(0, 10) ?? ""}
            onChange={e => setForm(p => ({ ...p, adjustment_date: new Date(e.target.value).toISOString() }))} />
        </div>
      </SidebarSection>
    </DialogForm>
  );
}
