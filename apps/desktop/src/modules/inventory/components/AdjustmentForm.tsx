import { useState, useEffect } from "react";
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { CreateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";

interface AdjustmentFormProps {
  onClose: () => void;
  products: MaterialDto[];
  onSave: (payload: CreateStockAdjustmentRequest) => Promise<void>;
  saving: boolean;
}

export function AdjustmentForm({ onClose, products, onSave, saving }: AdjustmentFormProps) {
  const [form, setForm] = useState<Partial<CreateStockAdjustmentRequest>>(() => ({
    adjustment_date: new Date().toISOString(),
    actual_quantity: 0,
    material_id: "",
    unit_cost: 0,
  }));

  useEffect(() => {
    setForm({ adjustment_date: new Date().toISOString(), actual_quantity: 0, material_id: "", unit_cost: 0 });
  }, []);

  const handleSave = async () => {
    if (!form.material_id || form.actual_quantity === undefined || !form.adjustment_date) return;
    await onSave(form as CreateStockAdjustmentRequest);
  };

  return (
    <FormPanel
      title="تسوية جرد جديدة"
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={saving || !form.material_id || form.actual_quantity === undefined || form.actual_quantity === null}
      saveLabel="تسوية"
    >
      <SidebarSection title="بيانات التسوية" defaultOpen={true}>
        <div className="space-y-4 text-right">
          <div className="space-y-2">
            <FieldLabel required>المادة</FieldLabel>
            <Select value={form.material_id ?? ""} onValueChange={val => setForm(p => ({ ...p, material_id: val }))}>
              <SelectTrigger className="w-full bg-white border-slate-200"><SelectValue placeholder="اختر المنتج..." /></SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel required>الكمية المجرودة</FieldLabel>
            <Input type="number" min="0" step="1"
              value={form.actual_quantity ?? ""}
              onChange={e => setForm(p => ({ ...p, actual_quantity: parseFloat(e.target.value) }))}
              className="bg-white border-slate-200"
              placeholder="أدخل الكمية..." />
          </div>
          <div className="space-y-2">
            <FieldLabel>التكلفة</FieldLabel>
            <Input type="number" min="0" step="0.01"
              value={form.unit_cost ?? ""}
              onChange={e => setForm(p => ({ ...p, unit_cost: parseFloat(e.target.value) || 0 }))}
              className="bg-white border-slate-200"
              placeholder="0" />
          </div>
          <div className="space-y-2">
            <FieldLabel>ملاحظة</FieldLabel>
            <Textarea value={form.notes ?? ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="bg-white border-slate-200" placeholder="سبب التسوية..." />
          </div>
          <div className="space-y-2">
            <FieldLabel>تاريخ التسوية</FieldLabel>
            <Input type="date"
              value={form.adjustment_date?.slice(0, 10) ?? ""}
              onChange={e => setForm(p => ({ ...p, adjustment_date: new Date(e.target.value).toISOString() }))}
              className="bg-white border-slate-200" />
          </div>
        </div>
      </SidebarSection>
    </FormPanel>
  );
}
