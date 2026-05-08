import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Badge } from "@shared/ui/badge";
import { Plus, Edit, Wand2, Hash, Barcode, Package, Layers, Shuffle, Check, Scale, Boxes, Package2 } from "lucide-react";
import { FormPanel } from '@widgets/form-shell/FormPanel';
import { cn } from '@shared/lib/utils';
import { toast } from "sonner";
import { materialCodeService } from '@modules/inventory/api/materialCodeService';
import { categoryService } from '@modules/inventory/api/categoryService';
import type { MaterialDto, CategoryDto } from "@erp/shared-types";

const DEFAULT_CATEGORY_NAME = "غير مصنف";

interface MaterialSavePayload {
  id?: string;
  name: string;
  barcode: string;
  code: string;
  minimum_stock: string;
  is_active: boolean;
  units: {
    name: string;
    conversion_factor: string;
    barcode: string;
  }[];
  category_ids: string[];
}

interface MaterialFormProps {
  open: boolean;
  onClose: () => void;
  material: MaterialDto | null;
  categories: CategoryDto[];
  onSave: (payload: MaterialSavePayload) => Promise<void>;
  saving?: boolean;
}

const EMPTY_FORM = {
  name: "",
  barcode: "",
  code: "",
  minimum_stock: "0",
  units: [
    { name: "قطعة", conversion_factor: "1", barcode: "" }
  ],
  selectedCategoryIds: [] as string[],
};

export function MaterialForm({ open, onClose, material, categories, onSave, saving }: MaterialFormProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const uncategorizedCat = useMemo(() => categories.find(c => c.name === DEFAULT_CATEGORY_NAME && !c.parent_id), [categories]);
  const mainCategories = useMemo(() => categories.filter(c => !c.parent_id && c.name !== DEFAULT_CATEGORY_NAME && !c.is_hybrid), [categories]);

  useEffect(() => {
    if (open) {
      if (material) {
        const baseUnit = material.units.find(u => u.is_base);
        setFormData({
          name: material.name,
          barcode: material.barcode || "",
          code: material.code || "",
          minimum_stock: material.minimum_stock,
          units: material.units.map(u => ({
            name: u.name,
            conversion_factor: u.conversion_factor,
            barcode: u.barcode || ""
          })),
          selectedCategoryIds: material.category_ids,
        });
      } else {
        setFormData({
          ...EMPTY_FORM,
          selectedCategoryIds: uncategorizedCat ? [uncategorizedCat.id] : [],
        });
      }
    }
  }, [open, material, uncategorizedCat]);

  const handleCategoryToggle = (id: string, isUncategorized: boolean, mainId?: string) => {
    setFormData(prev => {
      let nextIds = [...prev.selectedCategoryIds];
      if (isUncategorized) return { ...prev, selectedCategoryIds: [id] };
      
      nextIds = nextIds.filter(cid => cid !== uncategorizedCat?.id);

      if (mainId) {
        const existingInRow = nextIds.find(cid => {
          const cat = categories.find(c => c.id === cid);
          return cat?.parent_id === mainId;
        });
        
        if (existingInRow === id) {
          nextIds = nextIds.filter(cid => cid !== id);
        } else {
          nextIds = nextIds.filter(cid => categories.find(c => c.id === cid)?.parent_id !== mainId);
          nextIds.push(id);
        }
      } else {
        if (nextIds.includes(id)) nextIds = nextIds.filter(cid => cid !== id);
        else nextIds.push(id);
      }

      if (nextIds.length === 0 && uncategorizedCat) nextIds = [uncategorizedCat.id];
      return { ...prev, selectedCategoryIds: nextIds };
    });
  };

  const handleGenerateAutoCode = async () => {
    if (formData.selectedCategoryIds.length === 0) return;
    try {
      setIsGeneratingCode(true);
      if (formData.selectedCategoryIds.length > 1) {
        const prefixes = categories.filter(c => formData.selectedCategoryIds.includes(c.id)).map(c => c.code_prefix).filter(Boolean) as string[];
        if (prefixes.length === 0) { toast.error("التصنيفات المختارة لا تملك بادئات كود."); return; }
        const hybridCat = await categoryService.getOrCreateHybridCategory(prefixes);
        const code = await materialCodeService.generateCode(hybridCat.id);
        setFormData(prev => ({ ...prev, code }));
      } else {
        const code = await materialCodeService.generateCode(formData.selectedCategoryIds[0]);
        setFormData(prev => ({ ...prev, code }));
      }
      toast.success("تم توليد الكود بنجاح");
    } catch (error) { toast.error("فشل توليد الكود: " + error); }
    finally { setIsGeneratingCode(false); }
  };

  const generateHybridPrefix = () => {
    const prefixes = categories.filter(c => formData.selectedCategoryIds.includes(c.id)).map(c => c.code_prefix).filter(Boolean) as string[];
    return prefixes.join("");
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error("اسم المادة مطلوب"); return; }
    await onSave({
      ...formData,
      id: material?.id,
      is_active: material?.is_active ?? true,
      category_ids: formData.selectedCategoryIds,
    });
  };

  const addUnit = () => {
    setFormData(prev => ({
      ...prev,
      units: [...prev.units, { name: "", conversion_factor: "", barcode: "" }]
    }));
  };

  const removeUnit = (index: number) => {
    if (formData.units.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      units: prev.units.filter((_, i) => i !== index)
    }));
  };

  const updateUnit = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const nextUnits = [...prev.units];
      nextUnits[index] = { ...nextUnits[index], [field]: value };
      return { ...prev, units: nextUnits };
    });
  };

  if (!open) return null;

  return (
    <FormPanel 
      title={material ? "تعديل بطاقة المادة" : "إضافة مادة جديدة"}
      icon={material ? <Edit className="w-5 h-5 text-blue-600" /> : <Package2 className="w-5 h-5 text-emerald-600" />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={!formData.name.trim() || formData.selectedCategoryIds.length === 0}
      saveLabel={material ? "حفظ التعديلات" : "إضافة المادة"}
    >
      <div className="space-y-6 text-right">
        <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mb-2">
          <p className="text-xs text-blue-800">يرجى ملء البيانات التالية بدقة. الحقول المميزة بـ <span className="text-red-500">*</span> إجبارية.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">اسم المادة <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="اسم المادة" className="h-11 border-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700 flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-slate-400" /> الكود</Label>
                <div className="relative group">
                  <Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="h-10 font-mono text-xs pr-10" placeholder="الكود" dir="ltr" />
                  <Button size="icon" variant="ghost" onClick={handleGenerateAutoCode} disabled={isGeneratingCode || formData.selectedCategoryIds.length === 0} className="absolute right-1 top-1 h-8 w-8 text-blue-500"><Wand2 className={cn("w-4 h-4", isGeneratingCode && "animate-spin")} /></Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700 flex items-center gap-1.5"><Barcode className="w-3.5 h-3.5 text-slate-400" /> الباركود</Label>
                <Input value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} className="h-10 font-mono text-xs" placeholder="الباركود" dir="ltr" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700 flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-slate-400" /> حد الطلب</Label>
                <Input type="number" value={formData.minimum_stock} onChange={e => setFormData({ ...formData, minimum_stock: e.target.value })} className="h-10" />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-slate-800">وحدات القياس</span>
                </div>
                {!material && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={addUnit}
                    className="h-7 px-2 text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold gap-1"
                  >
                    <Plus className="w-3 h-3" /> إضافة وحدة
                  </Button>
                )}
              </div>
              
              <div className="space-y-3">
                {formData.units.map((unit, idx) => (
                  <div key={idx} className={cn(
                    "p-3 rounded-lg border bg-white space-y-3 relative transition-all",
                    idx === 0 ? "border-blue-100 shadow-sm" : "border-slate-100"
                  )}>
                    {idx > 0 && !material && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeUnit(idx)}
                        className="absolute -left-1.5 -top-1.5 h-6 w-6 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 border border-red-100 shadow-sm z-10"
                      >
                        <Check className="w-3 h-3 rotate-45" /> {/* Use X or Rotate Plus for delete */}
                      </Button>
                    )}
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500">اسم الوحدة {idx === 0 && <span className="text-blue-500">(الأساسية)</span>}</Label>
                        <Input 
                          value={unit.name} 
                          onChange={e => updateUnit(idx, "name", e.target.value)} 
                          className="h-9 text-xs" 
                          placeholder="مثلاً: قطعة، دزينة، طرد..."
                          disabled={!!material}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500">معامل التعبئة</Label>
                          <Input 
                            type="number"
                            value={unit.conversion_factor} 
                            onChange={e => updateUnit(idx, "conversion_factor", e.target.value)} 
                            className="h-9 text-xs font-bold" 
                            disabled={idx === 0 || !!material}
                            min="0"
                            step="any"
                          />
                          {idx === 0 && <p className="text-[8px] text-blue-400 font-medium">دائماً 1 للوحدة الأساسية</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500">باركود الوحدة</Label>
                          <Input 
                            value={unit.barcode} 
                            onChange={e => updateUnit(idx, "barcode", e.target.value)} 
                            className="h-9 text-xs font-mono" 
                            placeholder="اختياري" 
                            dir="ltr"
                            disabled={!!material}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {material && (
                <div className="bg-white/50 p-2 rounded border border-dashed border-slate-200">
                  <p className="text-[9px] text-slate-400 italic">
                    ملاحظة: لإضافة وحدات قياس أخرى بعد إنشاء المادة، استخدم خيار "إدارة الوحدات" من جدول المواد.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="font-bold text-slate-700 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-600" /> تصنيف المادة</Label>
            <div className="border rounded-lg overflow-hidden bg-white max-h-[350px] overflow-y-auto">
              <div className="bg-slate-50 px-4 py-2 border-b text-xs font-semibold text-slate-500 grid grid-cols-2 gap-4"><div>التصنيف الرئيسي</div><div>التصنيفات الفرعية</div></div>
              <div className="divide-y divide-slate-100">
                {uncategorizedCat && (
                  <div className="grid grid-cols-2 items-center min-h-[44px] hover:bg-slate-50/50">
                    <div className="px-4 py-2 font-medium text-blue-600">غير مصنف</div>
                    <div className="px-4 py-2"><div onClick={() => handleCategoryToggle(uncategorizedCat.id, true)} className={cn("flex items-center gap-2 px-3 py-1 rounded-md border cursor-pointer text-xs", formData.selectedCategoryIds.includes(uncategorizedCat.id) ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold" : "bg-white border-slate-200 text-slate-500")}>غير مصنف</div></div>
                  </div>
                )}
                {mainCategories.map(main => (
                  <div key={main.id} className="grid grid-cols-2 items-center min-h-[44px] hover:bg-slate-50/50">
                    <div className="px-4 py-2 font-medium text-slate-700">{main.name}</div>
                    <div className="px-4 py-2 flex flex-wrap gap-2">
                      {categories.filter(c => c.parent_id === main.id).map(sub => (
                        <div key={sub.id} onClick={() => handleCategoryToggle(sub.id, false, main.id)} className={cn("flex items-center gap-2 px-3 py-1 rounded-md border cursor-pointer text-[10px]", formData.selectedCategoryIds.includes(sub.id) ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold" : "bg-white border-slate-200 text-slate-500")}>
                          <div className={cn("w-3 h-3 rounded-sm border flex items-center justify-center", formData.selectedCategoryIds.includes(sub.id) ? "bg-emerald-600 border-emerald-600" : "border-slate-300")}>{formData.selectedCategoryIds.includes(sub.id) && <Check className="w-2 h-2 text-white" />}</div>
                          {sub.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {formData.selectedCategoryIds.length > 1 && (
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 flex items-start gap-3">
                <Shuffle className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="text-[10px] text-purple-600 leading-relaxed"><strong>مادة هجينة:</strong> سيتم توليد بادئة كود مدمجة: <span className="font-mono font-bold">{generateHybridPrefix()}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </FormPanel>
  );
}
