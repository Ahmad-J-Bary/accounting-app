import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import type { CreateDamagedItemRequest, MaterialDto } from "@erp/shared-types";

interface DamagedFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: MaterialDto[];
  onSave: (payload: CreateDamagedItemRequest) => Promise<void>;
  saving: boolean;
}

export function DamagedForm({ open, onOpenChange, products, onSave, saving }: DamagedFormProps) {
  const [form, setForm] = useState<Partial<CreateDamagedItemRequest>>({
    damage_date: new Date().toISOString(),
    quantity: 0,
    cost_impact: 0,
    reason: "",
    product_id: "",
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm({ damage_date: new Date().toISOString(), quantity: 0, cost_impact: 0, reason: "", product_id: "" });
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!form.product_id || !form.reason || !form.quantity) return;
    await onSave(form as CreateDamagedItemRequest);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسجيل مواد تالفة</DialogTitle>
          <DialogDescription>إضافة تقرير عن أصناف تالفة لخصمها من المخزون وتسجيل الخسائر.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>المنتج *</Label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={form.product_id ?? ""} 
              onChange={e => {
                const pid = e.target.value;
                const prod = products.find(p => p.id === pid);
                setForm(p => ({ 
                  ...p, 
                  product_id: pid,
                  cost_impact: prod ? parseFloat(prod.last_purchase_price || "0") * (p.quantity || 1) : p.cost_impact
                }));
              }}
            >
              <option value="">اختر المنتج...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>الكمية *</Label>
            <Input type="number" min="1" step="1"
              value={form.quantity ?? ""}
              onChange={e => {
                const qty = parseFloat(e.target.value) || 0;
                const prod = products.find(p => p.id === form.product_id);
                setForm(p => ({ 
                  ...p, 
                  quantity: qty,
                  cost_impact: prod ? parseFloat(prod.last_purchase_price || "0") * qty : p.cost_impact
                }));
              }} />
          </div>
          <div className="space-y-1">
            <Label>سبب التلف *</Label>
            <Input value={form.reason ?? ""} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="استهلاك، كسر، انتهاء صلاحية..." />
          </div>
          <div className="space-y-1">
            <Label>تأثير التكلفة</Label>
            <Input type="number" min="0" step="0.01"
              value={form.cost_impact ?? ""}
              onChange={e => setForm(p => ({ ...p, cost_impact: parseFloat(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label>تاريخ التلف</Label>
            <Input type="date"
              value={form.damage_date?.slice(0, 10) ?? ""}
              onChange={e => setForm(p => ({ ...p, damage_date: new Date(e.target.value).toISOString() }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || !form.product_id || !form.reason || !form.quantity}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
