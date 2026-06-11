import { useState, useEffect, useMemo, useCallback } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { WarehouseDto, MaterialDto, MaterialUnitDto } from "@erp/shared-types";
import type { CreateTransferRequest } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { Package, Warehouse, ArrowRightLeft, Calendar, FileText } from "lucide-react";
import { decomposeUnits, formatDecomposition } from "../lib/stockUtils";

interface TransferFormProps {
  open: boolean;
  onClose: () => void;
  warehouses: WarehouseDto[];
  products: MaterialDto[];
  onSave: (payload: CreateTransferRequest) => Promise<void>;
  saving: boolean;
  stockByWarehouse: Map<string, Map<string, number>>;
  initialMaterialId?: string;
  initialSourceWarehouseId?: string;
  lockMaterial?: boolean;
}

export function TransferForm({
  open,
  onClose,
  warehouses,
  products,
  onSave,
  saving,
  stockByWarehouse,
  initialMaterialId,
  initialSourceWarehouseId,
  lockMaterial = false
}: TransferFormProps) {
  const [form, setForm] = useState<CreateTransferRequest>({
    source_warehouse_id: "",
    dest_warehouse_id: "",
    material_id: "",
    quantity: "",
    transfer_date: new Date().toISOString(),
    notes: null,
  });
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [qtyInUnit, setQtyInUnit] = useState("");
  const [qtyRemainder, setQtyRemainder] = useState("");

  const resetAll = useCallback(() => {
    const matId = initialMaterialId || "";
    const srcWhId = initialSourceWarehouseId || "";
    setForm({
      source_warehouse_id: srcWhId,
      dest_warehouse_id: "",
      material_id: matId,
      quantity: "",
      transfer_date: new Date().toISOString(),
      notes: null,
    });
    const m = products.find(p => p.id === matId);
    const bu = m?.units.find(u => u.is_base) || m?.units[0];
    setSelectedUnitId(bu?.id || "");
    setQtyInUnit("");
    setQtyRemainder("");
  }, [initialMaterialId, initialSourceWarehouseId, products]);

  useEffect(() => { if (open) resetAll(); }, [open, resetAll]);

  const activeWarehouses = warehouses.filter(w => w.is_active);

  const sourceWarehouses = useMemo(() => {
    const active = warehouses.filter(w => w.is_active);
    if (lockMaterial && form.material_id) {
      return active.filter(w => {
        const whMap = stockByWarehouse.get(form.material_id);
        return (whMap?.get(w.id) || 0) > 0;
      });
    }
    return active;
  }, [warehouses, lockMaterial, form.material_id, stockByWarehouse]);

  const availableQtyBase = useMemo(() => {
    if (!form.source_warehouse_id || !form.material_id) return 0;
    const wh = stockByWarehouse.get(form.material_id);
    return wh?.get(form.source_warehouse_id) || 0;
  }, [stockByWarehouse, form.source_warehouse_id, form.material_id]);

  const materialsInSource = useMemo(() => {
    if (!form.source_warehouse_id) return [];
    return products.filter(p => {
      const wh = stockByWarehouse.get(p.id);
      const qty = wh?.get(form.source_warehouse_id) || 0;
      return qty > 0;
    });
  }, [products, stockByWarehouse, form.source_warehouse_id]);

  const selectedMaterial = useMemo(() => {
    return products.find(p => p.id === form.material_id) || null;
  }, [products, form.material_id]);

  const baseUnit = useMemo(() => {
    if (!selectedMaterial) return null;
    return selectedMaterial.units.find(u => u.is_base) || selectedMaterial.units[0] || null;
  }, [selectedMaterial]);

  const selectedUnit = useMemo(() => {
    if (!selectedMaterial) return null;
    return selectedMaterial.units.find(u => u.id === selectedUnitId) || baseUnit;
  }, [selectedMaterial, selectedUnitId, baseUnit]);

  const convFactor = useMemo(() => parseFloat(selectedUnit?.conversion_factor || "1"), [selectedUnit]);
  const isBaseSelected = selectedUnitId === "" || (baseUnit && selectedUnitId === baseUnit.id);

  const qtyInUnitNum = useMemo(() => parseFloat(qtyInUnit) || 0, [qtyInUnit]);
  const qtyRemainderNum = useMemo(() => parseFloat(qtyRemainder) || 0, [qtyRemainder]);
  const totalBase = useMemo(() => qtyInUnitNum * convFactor + qtyRemainderNum, [qtyInUnitNum, qtyRemainderNum, convFactor]);

  const maxUnitQty = useMemo(() => {
    if (convFactor === 0) return 0;
    return Math.floor(availableQtyBase / convFactor);
  }, [availableQtyBase, convFactor]);

  const remainderMax = useMemo(() => {
    const maxRem = Math.max(0, availableQtyBase - qtyInUnitNum * convFactor);
    return convFactor > 1 ? Math.min(maxRem, convFactor - 1) : maxRem;
  }, [availableQtyBase, qtyInUnitNum, convFactor]);

  const valid = useMemo(() =>
    form.source_warehouse_id &&
    form.dest_warehouse_id &&
    form.source_warehouse_id !== form.dest_warehouse_id &&
    form.material_id &&
    (isBaseSelected ? qtyInUnitNum > 0 : (qtyInUnitNum > 0 || qtyRemainderNum > 0)) &&
    totalBase > 0 &&
    totalBase <= availableQtyBase
  , [form, isBaseSelected, qtyInUnitNum, qtyRemainderNum, totalBase, availableQtyBase]);

  const availableParts = useMemo(() => {
    if (!selectedMaterial || availableQtyBase === 0) return [];
    return decomposeUnits(availableQtyBase, selectedMaterial.units);
  }, [selectedMaterial, availableQtyBase]);

  const availableText = useMemo(() => {
    if (!selectedMaterial || availableQtyBase === 0) return '';
    return formatDecomposition(availableParts);
  }, [availableParts, availableQtyBase, selectedMaterial]);

  const inputParts = useMemo(() => {
    if (!selectedMaterial || totalBase === 0) return [];
    return decomposeUnits(totalBase, selectedMaterial.units);
  }, [selectedMaterial, totalBase]);

  const handleSave = async () => {
    if (!valid) return;
    await onSave({ ...form, quantity: totalBase.toFixed(6) });
  };

  const handleUnitQtyChange = useCallback((val: string) => {
    const num = parseFloat(val);
    if (val !== "" && (isNaN(num) || num < 0)) return;
    const clamped = num > maxUnitQty ? String(maxUnitQty) : val;
    setQtyInUnit(clamped);
  }, [maxUnitQty]);

  const handleRemainderChange = useCallback((val: string) => {
    const num = parseFloat(val);
    if (val !== "" && (isNaN(num) || num < 0)) return;
    const clamped = num > remainderMax && convFactor > 1 ? String(remainderMax) : val;
    setQtyRemainder(clamped);
  }, [remainderMax, convFactor]);

  const handleUnitChange = useCallback((val: string) => {
    setSelectedUnitId(val);
    setQtyInUnit("");
    setQtyRemainder("");
  }, []);

  const handleMatChange = useCallback((val: string) => {
    setForm(p => ({ ...p, material_id: val, quantity: "" }));
    const m = products.find(p => p.id === val);
    const bu = m?.units.find(u => u.is_base) || m?.units[0];
    setSelectedUnitId(bu?.id || "");
    setQtyInUnit("");
    setQtyRemainder("");
  }, [products]);

  const handleSrcWhChange = useCallback((val: string) => {
    if (lockMaterial) {
      setForm(p => ({ ...p, source_warehouse_id: val, quantity: "" }));
      setQtyInUnit("");
      setQtyRemainder("");
    } else {
      setForm(p => ({ ...p, source_warehouse_id: val, material_id: "", quantity: "" }));
      setSelectedUnitId("");
      setQtyInUnit("");
      setQtyRemainder("");
    }
  }, [lockMaterial]);

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
      <SidebarSection icon={<Warehouse className="w-3.5 h-3.5" />} title="المستودعات" defaultOpen={true}>
        <div className="flex gap-2 items-end text-right">
          <div className="flex-1 space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5" required>
              <Warehouse className="w-3.5 h-3.5 text-slate-400" /> من مستودع
            </FieldLabel>
            <Select value={form.source_warehouse_id} onValueChange={handleSrcWhChange}>
              <SelectTrigger className="bg-white border-slate-200 h-9"><SelectValue placeholder="اختر المستودع المصدر..." /></SelectTrigger>
              <SelectContent>
                {sourceWarehouses.map(w => (
                  <SelectItem key={w.id} value={w.id} disabled={w.id === form.dest_warehouse_id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
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

      <SidebarSection icon={<Package className="w-3.5 h-3.5" />} title="المادة والكمية" defaultOpen={true}>
        <div className="space-y-2.5 text-right">
          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5" required>
              <Package className="w-3.5 h-3.5 text-slate-400" /> المادة
            </FieldLabel>
            {lockMaterial ? (
              <div className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-xs font-bold text-slate-700">
                {selectedMaterial?.name || "—"}
              </div>
            ) : (
              <Select value={form.material_id} onValueChange={handleMatChange} disabled={!form.source_warehouse_id}>
                <SelectTrigger className="bg-white border-slate-200 h-9">
                  <SelectValue placeholder={form.source_warehouse_id ? "اختر المادة..." : "اختر المستودع أولاً"} />
                </SelectTrigger>
                <SelectContent>
                  {materialsInSource.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-slate-400">لا توجد مواد متوفرة في هذا المستودع</div>
                  ) : (
                    materialsInSource.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <FieldLabel className="flex items-center gap-1.5 mb-1.5" required>
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" /> الكمية والوحدة
            </FieldLabel>
            {isBaseSelected ? (
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input type="number" min="0" max={availableQtyBase || undefined} step="any"
                    value={qtyInUnit}
                    onChange={e => {
                      const num = parseFloat(e.target.value);
                      if (e.target.value !== "" && (isNaN(num) || num < 0)) return;
                      const clamped = num > availableQtyBase ? String(availableQtyBase) : e.target.value;
                      setQtyInUnit(clamped);
                    }}
                    placeholder="0"
                    className="bg-white border-slate-200 h-9" />
                </div>
                <div className="shrink-0" style={{ width: "110px" }}>
                  <Select value={selectedUnitId} onValueChange={handleUnitChange} disabled={!selectedMaterial}>
                    <SelectTrigger className="bg-white border-slate-200 h-9 text-xs">
                      <SelectValue placeholder="الوحدة" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedMaterial?.units.map(u => (
                        <SelectItem key={u.id} value={u.id} className="text-xs">
                          {u.name}{u.conversion_factor !== "1" ? ` (×${u.conversion_factor})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-1.5 items-center">
                  <div className="flex-1">
                    <Input type="number" min="0" max={maxUnitQty || undefined} step="1"
                      value={qtyInUnit}
                      onChange={e => handleUnitQtyChange(e.target.value)}
                      placeholder="0"
                      className="bg-white border-slate-200 h-9" />
                  </div>
                  <div className="shrink-0 text-sm text-slate-500 font-medium px-1" style={{ minWidth: "70px", textAlign: "center" }}>
                    {selectedUnit?.name}
                  </div>
                  <div className="shrink-0 flex items-center justify-center px-1">
                    <span className="text-slate-300 text-lg font-light">+</span>
                  </div>
                  <div className="flex-1">
                    <Input type="number" min="0" max={remainderMax || undefined} step="any"
                      value={qtyRemainder}
                      onChange={e => handleRemainderChange(e.target.value)}
                      placeholder="0"
                      className="bg-white border-slate-200 h-9" />
                  </div>
                  <div className="shrink-0 text-sm text-slate-500 font-medium px-1" style={{ minWidth: "70px", textAlign: "center" }}>
                    {baseUnit?.name}
                  </div>
                  <div className="shrink-0" style={{ width: "110px" }}>
                    <Select value={selectedUnitId} onValueChange={handleUnitChange}>
                      <SelectTrigger className="bg-white border-slate-200 h-9 text-xs">
                        <SelectValue placeholder="الوحدة" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedMaterial?.units.map(u => (
                          <SelectItem key={u.id} value={u.id} className="text-xs">
                            {u.name}{u.conversion_factor !== "1" ? ` (×${u.conversion_factor})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {qtyInUnitNum > 0 && convFactor > 1 && (
                  <div className="text-[11px] text-slate-400 font-medium px-1">
                    أي {qtyInUnitNum.toLocaleString()} {selectedUnit?.name} × {convFactor} + {qtyRemainderNum.toLocaleString()} {baseUnit?.name} = {totalBase.toLocaleString()} {baseUnit?.name}
                  </div>
                )}
              </div>
            )}
            {form.material_id && form.source_warehouse_id && availableQtyBase > 0 && (
              <div className="text-[11px] text-slate-500 font-medium mt-1 px-1">
                المتوفر: {availableText}
              </div>
            )}
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
