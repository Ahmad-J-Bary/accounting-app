import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Wand2, Hash, Barcode, Package, Layers, Shuffle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { materialCodeService } from "@/services/materialCodeService";
import { categoryService } from "@/services/categoryService";
import type { MaterialDto, CategoryDto } from "@erp/shared-types";

const DEFAULT_CATEGORY_NAME = "غير مصنف";

interface MaterialFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MaterialDto | null;
  categories: CategoryDto[];
  onSave: (payload: any) => Promise<void>;
  saving?: boolean;
}

const EMPTY_FORM = {
  name: "",
  barcode: "",
  code: "",
  minimum_stock: "0",
  selectedCategoryIds: [] as string[],
};

export function MaterialForm({ open, onOpenChange, material, categories, onSave, saving }: MaterialFormProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const uncategorizedCat = useMemo(() => categories.find(c => c.name === DEFAULT_CATEGORY_NAME && !c.parent_id), [categories]);
  const mainCategories = useMemo(() => categories.filter(c => !c.parent_id && c.name !== DEFAULT_CATEGORY_NAME && !c.is_hybrid), [categories]);

  useEffect(() => {
    if (open) {
      if (material) {
        setFormData({
          name: material.name,
          barcode: material.barcode || "",
          code: material.code || "",
          minimum_stock: material.minimum_stock,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="border-b pb-4 mb-4">
          <DialogTitle className="text-xl flex items-center gap-2 text-slate-800">
            {material ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
            {material ? "تعديل بطاقة المادة" : "إضافة مادة جديدة"}
          </DialogTitle>
          <DialogDescription>يرجى ملء البيانات التالية بدقة. الحقول المميزة بـ <span className="text-red-500">*</span> إجبارية.</DialogDescription>
        </DialogHeader>

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
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">الحد الأدنى للمخزون</Label>
              <div className="relative">
                <Package className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <Input type="number" value={formData.minimum_stock} onChange={e => setFormData({ ...formData, minimum_stock: e.target.value })} className="h-10 pr-10" />
              </div>
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

        <DialogFooter className="border-t pt-6 mt-2 gap-3 flex-row-reverse">
          <Button onClick={handleSave} disabled={saving || !formData.name.trim() || formData.selectedCategoryIds.length === 0} className="h-11 px-8 bg-blue-600 hover:bg-blue-700 font-bold">{saving ? "جاري الحفظ..." : (material ? "حفظ التعديلات" : "إضافة المادة")}</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11">إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
