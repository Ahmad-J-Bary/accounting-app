import { useState, useEffect } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { WarehouseDto, MaterialDto } from "@erp/shared-types";
import type { CreateTransferRequest } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { Package, Warehouse, ArrowRightLeft, Calendar, FileText } from "lucide-react";

interface TransferFormProps {
  open: boolean;
  onClose: () => void;
  warehouses: WarehouseDto[];
  products: MaterialDto[];
  onSave: (payload: CreateTransferRequest) => Promise<void>;
  saving: boolean;
}

export function TransferForm({ open, onClose, warehouses, products, onSave, saving }: TransferFormProps) {
  const [form, setForm] = useState<CreateTransferRequest>({
    source_warehouse_id: "",
    dest_warehouse_id: "",
    material_id: "",
    quantity: "",
    transfer_date: new Date().toISOString(),
    notes: null,
  });

  useEffect(() => {
    if (open) {
      setForm({
        source_warehouse_id: "",
        dest_warehouse_id: "",
        material_id: "",
        quantity: "",
        transfer_date: new Date().toISOString(),
        notes: null,
      });
    }
  }, [open]);

  const valid =
    form.source_warehouse_id &&
    form.dest_warehouse_id &&
    form.source_warehouse_id !== form.dest_warehouse_id &&
    form.material_id &&
    parseFloat(form.quantity) > 0;

  const handleSave = async () => {
    if (!valid) return;
    await onSave(form);
  };

  const activeWarehouses = warehouses.filter(w => w.is_active);

  if (!open) return null;

  return (
    <FormPanel
      title="تحويل مخزني جديد"
      icon={<ArrowRightLeft className="w-5 h-5 text-blue-600" />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={!valid}
      saveLabel="حفظ التحويل"
    >
      <SidebarSection icon={<Package className="w-3.5 h-3.5" />} title="المادة والكمية" defaultOpen={true}>
        <div className="space-y-2.5 text-right">
          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5" required>
              <Package className="w-3.5 h-3.5 text-slate-400" /> المادة
            </FieldLabel>
            <Select value={form.material_id} onValueChange={val => setForm(p => ({ ...p, material_id: val }))}>
              <SelectTrigger className="bg-white border-slate-200 h-9"><SelectValue placeholder="اختر المادة..." /></SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5" required>
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" /> الكمية
            </FieldLabel>
            <Input type="number" min="0" step="any"
              value={form.quantity}
              onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
              placeholder="0"
              className="bg-white border-slate-200 h-9" />
          </div>
        </div>
      </SidebarSection>
      <SidebarSection icon={<Warehouse className="w-3.5 h-3.5" />} title="المستودعات" defaultOpen={true}>
        <div className="space-y-2.5 text-right">
          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5" required>
              <Warehouse className="w-3.5 h-3.5 text-slate-400" /> من مستودع
            </FieldLabel>
            <Select value={form.source_warehouse_id} onValueChange={val => setForm(p => ({ ...p, source_warehouse_id: val }))}>
              <SelectTrigger className="bg-white border-slate-200 h-9"><SelectValue placeholder="اختر المستودع المصدر..." /></SelectTrigger>
              <SelectContent>
                {activeWarehouses.map(w => (
                  <SelectItem key={w.id} value={w.id} disabled={w.id === form.dest_warehouse_id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5" required>
              <Warehouse className="w-3.5 h-3.5 text-slate-400" /> إلى مستودع
            </FieldLabel>
            <Select value={form.dest_warehouse_id} onValueChange={val => setForm(p => ({ ...p, dest_warehouse_id: val }))}>
              <SelectTrigger className="bg-white border-slate-200 h-9"><SelectValue placeholder="اختر مستودع الوجهة..." /></SelectTrigger>
              <SelectContent>
                {activeWarehouses.map(w => (
                  <SelectItem key={w.id} value={w.id} disabled={w.id === form.source_warehouse_id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SidebarSection>
      <SidebarSection icon={<Calendar className="w-3.5 h-3.5" />} title="التاريخ والملاحظات" defaultOpen={true}>
        <div className="space-y-2.5 text-right">
          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> تاريخ التحويل
            </FieldLabel>
            <Input type="date"
              value={form.transfer_date?.slice(0, 10) ?? ""}
              onChange={e => setForm(p => ({ ...p, transfer_date: new Date(e.target.value).toISOString() }))}
              className="bg-white border-slate-200 h-9" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> ملاحظات
            </FieldLabel>
            <Input value={form.notes ?? ""}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value || null }))}
              placeholder="سبب التحويل..."
              className="bg-white border-slate-200 h-9" />
          </div>
        </div>
      </SidebarSection>
    </FormPanel>
  );
}