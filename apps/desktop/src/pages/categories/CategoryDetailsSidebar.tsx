import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Shuffle, Package, Hash, Barcode, Layers, Wand2, Scale, Boxes } from "lucide-react";
import type { CategoryDto, MaterialDto } from "@erp/shared-types";
import { categoryService } from "@/services/categoryService";
import { materialService } from "@/services/materialService";
import { materialCodeService } from "@/services/materialCodeService";
import { TreeSidebar } from "../../components/erp/tree-management/TreeSidebar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CategoryTreeNode extends CategoryDto {
  children: CategoryTreeNode[];
  isMaterial?: boolean;
  materialData?: MaterialDto;
}

interface CategoryDetailsSidebarProps {
  selected: CategoryTreeNode | null; 
  allCategories: CategoryDto[];
  parentName?: string | null;
  onSaved: () => void;
  onDelete: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  isVirtualRootSelected?: boolean;
}

const DEFAULT_CATEGORY_NAME = "غير مصنف";

export function CategoryDetailsSidebar({
  selected,
  allCategories,
  parentName,
  onSaved,
  onDelete,
  canEdit = true,
  canDelete = true,
  isVirtualRootSelected = false,
}: CategoryDetailsSidebarProps) {
  const [formMode, setFormMode] = useState<"create_cat" | "edit_cat" | "create_mat" | "edit_mat" | null>(null);
  
  // Shared fields
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Category fields
  const [parentId, setParentId] = useState<string | null>(null);
  const [codePrefix, setCodePrefix] = useState("");

  // Material fields
  const [barcode, setBarcode] = useState("");
  const [code, setCode] = useState("");
  const [minimumStock, setMinimumStock] = useState("0");
  const [baseUnitName, setBaseUnitName] = useState("قطعة");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const isMaterial = !!selected?.isMaterial;
  const materialData = selected?.materialData as MaterialDto | undefined;
  const isUncategorized = selected?.name === DEFAULT_CATEGORY_NAME && !isMaterial;
  const isSubCategory = !!selected?.parent_id && !isMaterial;
  const isRoot = selected && !selected.parent_id && !isUncategorized && !isMaterial;

  const getGeneralSubPrefix = useCallback((rootId: string) => {
    const generalSub = allCategories.find(c => c.parent_id === rootId && c.name.endsWith("عام"));
    return generalSub?.code_prefix || "";
  }, [allCategories]);

  useEffect(() => {
    setFormMode(null);
    setError(null);
    if (selected) {
      if (isMaterial && materialData) {
        const baseUnit = materialData.units?.find(u => u.is_base);
        setName(materialData.name);
        setBarcode(materialData.barcode || "");
        setCode(materialData.code || "");
        setMinimumStock(materialData.minimum_stock || "0");
        setBaseUnitName(baseUnit?.name || "قطعة");
      } else {
        setName(selected.name);
        setParentId(selected.parent_id || null);
        if (isUncategorized && !selected.code_prefix) setCodePrefix("غ");
        else if (isRoot) setCodePrefix(getGeneralSubPrefix(selected.id));
        else setCodePrefix(selected.code_prefix || "");
      }
    } else {
      setName("");
      setParentId(null);
      setCodePrefix("");
      setBarcode("");
      setCode("");
      setMinimumStock("0");
      setBaseUnitName("قطعة");
    }
  }, [selected, isVirtualRootSelected, isRoot, getGeneralSubPrefix, isMaterial, materialData, isUncategorized]);

  const suggestPrefix = useCallback(() => {
    const chars = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي";
    const existingPrefixes = new Set(allCategories.map(c => c.code_prefix).filter(Boolean));
    for (const char of chars) { if (!existingPrefixes.has(char)) return char; }
    return "X"; 
  }, [allCategories]);

  const handleGenerateAutoCode = async () => {
    const categoryId = selected?.id;
    if (!categoryId || isMaterial) return;
    try {
      setIsGeneratingCode(true);
      const generated = await materialCodeService.generateCode(categoryId);
      setCode(generated);
      toast.success("تم توليد الكود");
    } catch (err) {
      toast.error("فشل التوليد: " + err);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const openCreate = () => {
    if (isSubCategory || isUncategorized) {
      setFormMode("create_mat");
      setError(null);
      setName("");
      setBarcode("");
      setCode("");
      setMinimumStock("0");
      setBaseUnitName("قطعة");
      return;
    }
    setFormMode("create_cat");
    setError(null);
    setName("");
    setParentId(selected?.id || null);
    setCodePrefix(suggestPrefix());
  };

  const openEdit = () => {
    if (!selected || !canEdit) return;
    if (isMaterial) {
      setFormMode("edit_mat");
    } else {
      setFormMode("edit_cat");
    }
    setError(null);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("الاسم مطلوب"); return; }
    setSaving(true);
    try {
      if (formMode === "create_mat" || formMode === "edit_mat") {
        let finalCode = code.trim();
        // Zero-waste generation if empty on save
        if (formMode === "create_mat" && !finalCode && selected?.id) {
          finalCode = await materialCodeService.generateCode(selected.id);
        }

        if (formMode === "edit_mat" && materialData) {
          await materialService.updateMaterial({
            ...materialData,
            name: name.trim(),
            barcode: barcode.trim(),
            code: finalCode,
            minimum_stock: minimumStock,
          });
          toast.success("تم تحديث المادة");
        } else {
          await materialService.createMaterial({
            name: name.trim(),
            barcode: barcode.trim(),
            code: finalCode,
            minimum_stock: minimumStock,
            base_unit_name: baseUnitName,
            category_ids: [selected.id],
          });
          toast.success("تمت إضافة المادة");
        }
      } else {
        // Category Save Logic
        if (codePrefix.trim().length === 0 && (formMode === "create_cat" || isUncategorized)) {
          setError("بادئة الكود مطلوبة."); setSaving(false); return;
        }
        if (formMode === "edit_cat" && selected) {
          if (isRoot) {
            await categoryService.updateCategory({ 
              id: selected.id, 
              name: name.trim(), 
              is_active: selected.is_active,
              code_prefix: null 
            });
            const generalSub = allCategories.find(c => c.parent_id === selected.id && c.name.endsWith("عام"));
            if (generalSub) {
              await categoryService.updateCategory({ 
                id: generalSub.id, 
                name: `${name.trim()} عام`, 
                is_active: generalSub.is_active,
                code_prefix: codePrefix.trim().toUpperCase() 
              });
            }
          } else {
            await categoryService.updateCategory({ 
              id: selected.id, 
              name: name.trim(), 
              parent_id: parentId || undefined, 
              is_active: selected.is_active,
              code_prefix: codePrefix.trim().toUpperCase() || null 
            });
          }
          toast.success("تم تحديث التصنيف");
        } else {
          await categoryService.createCategory({ name: name.trim(), parent_id: parentId || undefined, code_prefix: codePrefix.trim().toUpperCase() || null });
          toast.success("تمت إضافة التصنيف");
        }
      }
      setFormMode(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشلت العملية");
    } finally {
      setSaving(false);
    }
  };

  const detailsView = (
    <div className="grid gap-3">
      {!selected ? (
        <p className="text-sm text-slate-500">{isVirtualRootSelected ? "شجرة التصنيفات (الجذر)" : "اختر عنصراً من الشجرة."}</p>
      ) : isMaterial ? (
        <>
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500 mb-1">اسم المادة</p>
            <p className="font-semibold text-slate-800">{materialData?.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500 mb-1">الكود</p>
              <p className="font-mono text-xs font-bold">{materialData?.code}</p>
            </div>
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500 mb-1">الباركود</p>
              <p className="font-mono text-xs">{materialData?.barcode || "—"}</p>
            </div>
          </div>
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500 mb-1">الحد الأدنى للمخزون</p>
            <p className="font-bold">{materialData?.minimum_stock}</p>
          </div>
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500 mb-1">الوحدة الأساسية</p>
            <p className="font-bold">{materialData?.units?.find(u => u.is_base)?.name || "قطعة"}</p>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500 mb-1">اسم التصنيف</p>
            <p className="font-semibold text-slate-800">{selected.name}</p>
          </div>
          {codePrefix && (
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500 mb-1">البادئة</p>
              <p className="font-semibold tabular-nums">{codePrefix}</p>
            </div>
          )}
        </>
      )}
    </div>
  );

  const formPanel = (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-md px-3 py-2 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      
      {(formMode === "create_mat" || formMode === "edit_mat") ? (
        <>
          <div className="space-y-1">
            <Label>اسم المادة <span className="text-red-500">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="اسم المادة" className="bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>الكود</Label>
              <div className="relative group">
                <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="توليد تلقائي" className="bg-white font-mono text-xs pr-10" dir="ltr" />
                <Button size="icon" variant="ghost" onClick={handleGenerateAutoCode} disabled={isGeneratingCode} className="absolute right-1 top-1 h-8 w-8 text-blue-500 hover:bg-blue-50"><Wand2 className={cn("w-4 h-4", isGeneratingCode && "animate-spin")} /></Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>الباركود</Label>
              <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="000000" className="bg-white font-mono text-xs" dir="ltr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5"><Scale className="w-3.5 h-3.5 text-slate-400" /> الوحدة الأساسية</Label>
              <Input value={baseUnitName} onChange={e => setBaseUnitName(e.target.value)} placeholder="قطعة" className="bg-white" disabled={formMode === "edit_mat"} />
            </div>
            <div className="space-y-1">
              <Label>الحد الأدنى</Label>
              <Input type="number" value={minimumStock} onChange={e => setMinimumStock(e.target.value)} className="bg-white" />
            </div>
          </div>
          <div className="bg-slate-50 rounded-md p-3 border border-slate-100 flex items-center gap-3">
            <Layers className="w-4 h-4 text-emerald-500" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">تصنيف المادة</p>
              <p className="text-xs font-bold text-slate-700">{selected?.name}</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <Label>اسم التصنيف</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: ساعات" className="bg-white" disabled={isUncategorized && formMode === "edit_cat"} />
          </div>
          <div className="space-y-1">
            <Label>{!parentId || isRoot ? "بادئة التصنيف الفرعي العام" : "بادئة الكود"}</Label>
            <div className="flex gap-2">
              <Input value={codePrefix} onChange={e => setCodePrefix(e.target.value.slice(0, 1).toUpperCase())} placeholder="A" className="bg-white font-mono text-center" maxLength={1} />
              <Button variant="outline" size="icon" onClick={() => setCodePrefix(suggestPrefix())} title="اقتراح بادئة"><Shuffle className="w-4 h-4" /></Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
  return (
    <TreeSidebar
      title={formMode?.startsWith("create") ? "إضافة" : formMode?.startsWith("edit") ? "تعديل" : "التفاصيل"}
      selected={selected}
      formMode={formMode?.startsWith("create") ? "create" : formMode?.startsWith("edit") ? "edit" : null}
      onOpenCreate={openCreate}
      onOpenEdit={openEdit}
      onDelete={onDelete}
      onCancel={() => setFormMode(null)}
      onSave={handleSave}
      saving={saving}
      canEdit={canEdit}
      canDelete={canDelete && !isUncategorized && (selected?.material_count || 0) === 0 && !isMaterial}
      formPanel={formPanel}
      disableNew={false}
      newButtonLabel={isSubCategory || isUncategorized ? "مادة جديدة" : "تصنيف جديد"}
    >
      {detailsView}
    </TreeSidebar>
  );
}
