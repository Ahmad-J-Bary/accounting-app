import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Trash2, Plus, Scale, Boxes, Barcode } from "lucide-react";
import { toast } from "sonner";
import { materialService } from '@modules/inventory/api/materialService';
import type { MaterialDto } from "@erp/shared-types";

interface MaterialUnitsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MaterialDto | null;
  onUnitsUpdated: () => void;
}

export function MaterialUnitsManager({ open, onOpenChange, material, onUnitsUpdated }: MaterialUnitsManagerProps) {
  const [newUnit, setNewUnit] = useState({ name: "", factor: "1", barcode: "" });
  const [loading, setLoading] = useState(false);

  if (!material) return null;

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

  const baseUnit = material.units.find(u => u.is_base);
  const secondaryUnits = material.units.filter(u => !u.is_base);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" dir="rtl">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl flex items-center gap-2 text-slate-800">
            <Scale className="w-5 h-5 text-blue-600" />
            إدارة وحدات القياس: {material.name}
          </DialogTitle>
          <DialogDescription>
            حدد الوحدات المختلفة للمادة ومعامل التحويل بالنسبة للوحدة الأساسية ({baseUnit?.name}).
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Base Unit Info */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
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
          <div className="space-y-3">
            <Label className="text-slate-700 font-bold">الوحدات الأخرى</Label>
            {secondaryUnits.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 bg-slate-50/50 rounded-md border border-dashed">لا توجد وحدات إضافية معرفة لهذه المادة.</p>
            ) : (
              <div className="space-y-2">
                {secondaryUnits.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-50 p-2 rounded">
                        <Boxes className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{u.name}</p>
                        <p className="text-[11px] text-slate-500">1 {u.name} = {u.conversion_factor} {baseUnit?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {u.barcode && (
                        <div className="text-left hidden sm:block">
                          <p className="text-[9px] text-slate-400">الباركود</p>
                          <p className="text-[10px] font-mono">{u.barcode}</p>
                        </div>
                      )}
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
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

          {/* Add New Unit Form */}
          <div className="border-t pt-4 space-y-4">
            <Label className="text-slate-700 font-bold">إضافة وحدة قياس جديدة</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">اسم الوحدة</Label>
                <Input 
                  value={newUnit.name} 
                  onChange={e => setNewUnit({...newUnit, name: e.target.value})}
                  placeholder="مثلاً: طرد، دزينة"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">معامل التعبئة</Label>
                <Input 
                  type="number"
                  value={newUnit.factor} 
                  onChange={e => setNewUnit({...newUnit, factor: e.target.value})}
                  placeholder="عدد القطع"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">الباركود (اختياري)</Label>
                <Input 
                  value={newUnit.barcode} 
                  onChange={e => setNewUnit({...newUnit, barcode: e.target.value})}
                  placeholder="باركود الوحدة"
                  className="h-9 text-sm font-mono"
                  dir="ltr"
                />
              </div>
            </div>
            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700 h-9" 
              onClick={handleAddUnit}
              disabled={loading || !newUnit.name.trim()}
            >
              <Plus className="w-4 h-4 ml-2" />
              إضافة الوحدة
            </Button>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
