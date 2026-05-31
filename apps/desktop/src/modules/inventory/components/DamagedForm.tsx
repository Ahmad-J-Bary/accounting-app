import { useState, useEffect } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { CreateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { AlertTriangle } from "lucide-react";

interface DamagedFormProps {
  onClose: () => void;
  products: MaterialDto[];
  onSave: (payload: CreateDamagedItemRequest) => Promise<void>;
  saving: boolean;
  initialMaterialId?: string;
}

export function DamagedForm({ onClose, products, onSave, saving, initialMaterialId }: DamagedFormProps) {
  const [form, setForm] = useState<Partial<CreateDamagedItemRequest>>(() => {
    const prod = products.find(p => p.id === initialMaterialId);
    return {
      damage_date: new Date().toISOString(),
      quantity: 0,
      cost_impact: prod ? parseFloat(prod.last_purchase_price || "0") : 0,
      reason: "",
      material_id: initialMaterialId ?? "",
    };
  });

  useEffect(() => {
    const prod = products.find(p => p.id === initialMaterialId);
    setForm({
      damage_date: new Date().toISOString(),
      quantity: 0,
      cost_impact: prod ? parseFloat(prod.last_purchase_price || "0") : 0,
      reason: "",
      material_id: initialMaterialId ?? "",
    });
  }, [initialMaterialId, products]);

  const handleSave = async () => {
    if (!form.material_id || !form.reason || !form.quantity) return;
    await onSave(form as CreateDamagedItemRequest);
  };

  return (
    <FormPanel
      title="تسجيل مواد تالفة"
      icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={saving || !form.material_id || !form.reason || !form.quantity}
      saveLabel="تسجيل التالف"
    >
      <SidebarSection title="بيانات التلف" defaultOpen={true}>
        <div className="space-y-4 text-right">
          {/* المنتج */}
          <div className="space-y-2">
            <FieldLabel required>المنتج / الصنف</FieldLabel>
            <Select
              value={form.material_id ?? ""}
              onValueChange={(val) => {
                const mid = val;
                const prod = products.find((p) => p.id === mid);
                setForm((p) => ({
                  ...p,
                  material_id: mid,
                  cost_impact: prod
                    ? parseFloat(prod.last_purchase_price || "0") * ((p.quantity as number) || 1)
                    : p.cost_impact,
                }));
              }}
            >
              <SelectTrigger className="w-full bg-white border-slate-200">
                <SelectValue placeholder="اختر المنتج..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* الكمية */}
          <div className="space-y-2">
            <FieldLabel required>الكمية التالفة</FieldLabel>
            <Input
              type="number"
              min="1"
              step="1"
              value={form.quantity || ""}
              onChange={(e) => {
                const qty = parseFloat(e.target.value) || 0;
                const prod = products.find((p) => p.id === form.material_id);
                setForm((p) => ({
                  ...p,
                  quantity: qty,
                  cost_impact: prod ? parseFloat(prod.last_purchase_price || "0") * qty : p.cost_impact,
                }));
              }}
              className="bg-white border-slate-200"
              placeholder="أدخل الكمية..."
            />
          </div>

          {/* سبب التلف */}
          <div className="space-y-2">
            <FieldLabel required>سبب التلف</FieldLabel>
            <Input
              value={form.reason ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="استهلاك، كسر، انتهاء صلاحية..."
              className="bg-white border-slate-200"
            />
          </div>

          {/* تأثير التكلفة */}
          <div className="space-y-2">
            <FieldLabel>تأثير التكلفة المالي</FieldLabel>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.cost_impact || ""}
              onChange={(e) => setForm((p) => ({ ...p, cost_impact: parseFloat(e.target.value) || 0 }))}
              className="bg-white border-slate-200 font-bold text-slate-700"
              placeholder="التأثير المالي للمواد التالفة..."
            />
          </div>

          {/* تاريخ التلف */}
          <div className="space-y-2">
            <FieldLabel>تاريخ التلف</FieldLabel>
            <Input
              type="date"
              value={form.damage_date?.slice(0, 10) ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, damage_date: new Date(e.target.value).toISOString() }))}
              className="bg-white border-slate-200"
            />
          </div>
        </div>
      </SidebarSection>
    </FormPanel>
  );
}
