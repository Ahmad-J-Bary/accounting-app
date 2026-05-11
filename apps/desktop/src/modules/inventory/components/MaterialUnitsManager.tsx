import { useState } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { X, Plus, Trash2, Scale, Boxes, Package, Wand2, Check } from "lucide-react";
import { toast } from "sonner";
import { FormPanel } from '@widgets/form-shell/FormPanel';
import { materialService } from '@modules/inventory/api/materialService';
import type { MaterialDto, MaterialUnitDto } from "@erp/shared-types";
import { cn } from '@shared/lib/utils';

interface MaterialUnitsManagerProps {
  material: MaterialDto | null;
  onClose: () => void;
  onUnitsUpdated: () => void;
}

export function MaterialUnitsManager({ material, onClose, onUnitsUpdated }: MaterialUnitsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUnit, setNewUnit] = useState({ name: "", factor: "1", barcode: "" });
  const [loading, setLoading] = useState(false);

  if (!material) return null;

  const baseUnit = material.units?.find(u => u.is_base);
  const secondaryUnits = material.units?.filter(u => !u.is_base) || [];

  const handleAddUnit = async () => {
    if (!newUnit.name.trim()) { toast.error("اسم الوحدة مطلوب"); return; }
    if (parseFloat(newUnit.factor) <= 0) { toast.error("معامل التعبئة يجب أن يكون أكبر من صفر"); return; }

    setLoading(true);
    try {
      await materialService.addMaterialUnit({
        material_id: material.id,
        name: newUnit.name,
        conversion_factor: newUnit.factor,
        barcode: newUnit.barcode || undefined,
      });
      toast.success("تمت إضافة الوحدة بنجاح");
      setNewUnit({ name: "", factor: "1", barcode: "" });
      setShowAddForm(false);
      onUnitsUpdated();
    } catch (err) {
      toast.error("فشل إضافة الوحدة: " + err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الوحدة؟")) return;

    setLoading(true);
    try {
      await materialService.deleteMaterialUnit(unitId);
      toast.success("تم حذف الوحدة");
      onUnitsUpdated();
    } catch (err) {
      toast.error("فشل حذف الوحدة: " + err);
    } finally {
      setLoading(false);
    }
  };

  const unitFormContent = (
    <div className="space-y-6 text-right">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-700">اسم الوحدة <span className="text-red-500">*</span></Label>
          <Input
            value={newUnit.name}
            onChange={e => setNewUnit({ ...newUnit, name: e.target.value })}
            placeholder="مثلاً: طرد، دزينة"
            className="h-9 text-sm"
            dir="rtl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-700">معامل التعبئة <span className="text-red-500">*</span></Label>
          <Input
            type="number"
            value={newUnit.factor}
            onChange={e => setNewUnit({ ...newUnit, factor: e.target.value })}
            placeholder="مثلاً: 12"
            className="h-9 text-sm font-bold"
            min="0.000001"
            step="any"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-700">الباركود (اختياري)</Label>
          <Input
            value={newUnit.barcode}
            onChange={e => setNewUnit({ ...newUnit, barcode: e.target.value })}
            placeholder="باركود الوحدة"
            className="h-9 text-sm font-mono"
            dir="ltr"
          />
        </div>
      </div>

      {newUnit.name && (
        <div className="bg-blue-50 rounded-md p-3 border border-blue-100 flex items-center gap-3">
          <Package className="w-4 h-4 text-blue-500" />
          <div>
            <p className="text-[10px] text-blue-400 font-bold uppercase">إضافة للمادة</p>
            <p className="text-xs font-bold text-blue-700">{material.name}</p>
          </div>
          <div className="text-left ml-auto">
            <p className="text-[9px] text-slate-500">معامل التعادل</p>
            <p className="text-sm font-mono text-blue-700">1 {newUnit.name} = {newUnit.factor || "1"} {baseUnit?.name}</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50 shrink-0">
        <div className="flex flex-col gap-1 text-right">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            إدارة وحدات القياس
          </h2>
          <span className="text-xs text-muted-foreground">{material.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {!showAddForm && (
            <Button
              variant="outline"
              size="sm"
              className="bg-emerald-500 text-white hover:bg-emerald-600 border-none h-8 px-3 rounded-lg"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-3.5 h-3.5 ml-1.5" />
              إضافة وحدة جديدة
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Show Units List or Add Form */}
        {showAddForm ? (
          <FormPanel
            title="إضافة وحدة قياس جديدة"
            icon={<Package className="w-5 h-5 text-emerald-600" />}
            onClose={() => {
              setShowAddForm(false);
              setNewUnit({ name: "", factor: "1", barcode: "" });
            }}
            onSave={handleAddUnit}
            isSaving={loading}
            saveDisabled={!newUnit.name.trim()}
            saveLabel="إضافة الوحدة"
          >
            {unitFormContent}
          </FormPanel>
        ) : (
          <div className="p-6">
            {/* Base Unit Info */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center mb-4">
              <div>
                <p className="text-[10px] text-slate-400 font-bold">الوحدة الأساسية (أصغر وحدة)</p>
                <p className="text-sm font-bold text-slate-700">{baseUnit?.name || "قطعة"}</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-slate-400 font-bold">الباركود</p>
                <p className="text-xs font-mono">{baseUnit?.barcode || "—"}</p>
              </div>
            </div>

            {/* Secondary Units List */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-800">الوحدات الحالية ({secondaryUnits.length})</h3>
              {secondaryUnits.length === 0 ? (
                <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed">
                  <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-xs text-slate-400 mb-3">لا توجد وحدات إضافية معرفة لهذه المادة.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus className="w-3.5 h-3.5 ml-1.5" />
                    إضافة أول وحدة
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {secondaryUnits.map((u: MaterialUnitDto) => (
                    <div key={u.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50/50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-1.5 rounded">
                          <Boxes className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-slate-700">{u.name}</span>
                          <span className="text-[11px] text-slate-500">1 {u.name} = {u.conversion_factor} {baseUnit?.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.barcode && (
                          <span className="text-[9px] font-mono text-slate-400 hidden sm:inline">{u.barcode}</span>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteUnit(u.id)}
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}