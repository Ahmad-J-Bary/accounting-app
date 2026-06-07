import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { AlertCircle, Shuffle, Package, Hash, Barcode, Layers, Scale, Boxes } from "lucide-react";
import type { CategoryDto, MaterialDto } from "@erp/shared-types";
import { categoryService } from '@modules/inventory/api/categoryService';
import { materialService } from '@modules/inventory/api/materialService';
import { materialCodeService } from '@modules/inventory/api/materialCodeService';
import { TreeSidebar } from '@widgets/tree-sidebar/TreeSidebar';
import { FieldLabel } from '@widgets/sidebar-shell/FieldLabel';
import { toast } from "sonner";
import { cn } from '@shared/lib/utils';

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
  const [formMode, setFormMode] = useState<"create_cat" | "edit_cat" | "create_mat" | "edit_mat" | "create_unit" | null>(null);
  
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
  // Unit fields
  const [unitName, setUnitName] = useState("");
  const [unitFactor, setUnitFactor] = useState("");
  const [unitBarcode, setUnitBarcode] = useState("");

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

  useEffect(() => {
    if (formMode === "create_mat" && selected?.id) {
      let cancelled = false;
      materialCodeService.previewCode(selected.id)
        .then(generated => { if (!cancelled) setCode(generated); })
        .catch(() => {});
      return () => { cancelled = true; };
    }
  }, [formMode, selected?.id]);

  const openCreate = useCallback(() => {
    if (isMaterial) {
      setFormMode("create_unit");
      setError(null);
      setUnitName("");
      setUnitFactor("");
      setUnitBarcode("");
      return;
    }
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
  }, [isMaterial, isSubCategory, isUncategorized, selected, suggestPrefix]);

  useEffect(() => {
    const handler = () => openCreate();
    window.addEventListener("erp:open-new-category", handler);
    return () => window.removeEventListener("erp:open-new-category", handler);
  }, [openCreate]);

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
        // Reserve the sequence on save (preview didn't increment)
        if (formMode === "create_mat" && selected?.id) {
          try {
            finalCode = await materialCodeService.generateCode(selected.id);
          } catch { /* keep preview or empty */ }
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
            units: [{ name: baseUnitName, conversion_factor: "1", barcode: barcode.trim() || null }],
            category_ids: [selected.id],
            purchase_prices: [],
            sale_prices: [],
          });
          toast.success("تمت إضافة المادة");
        }
      } else if (formMode === "create_unit") {
        if (!unitName.trim() || !unitFactor.trim()) {
          setError("اسم الوحدة والمعامل مطلوبان");
          setSaving(false);
          return;
        }
        await materialService.addMaterialUnit({
          material_id: materialData?.id,
          name: unitName.trim(),
          conversion_factor: unitFactor.trim(),
          barcode: unitBarcode.trim() || null
        });
        toast.success("تمت إضافة وحدة القياس");
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
          <div className="rounded-md border bg-slate-50 p-3 space-y-2">
            <p className="text-[11px] text-slate-500 flex items-center gap-2">
              <Scale className="w-3 h-3" /> وحدات القياس
            </p>
            <div className="space-y-1.5">
              {materialData?.units?.map(u => (
                <div key={u.id} className={cn(
                  "flex items-center justify-between p-2 rounded border text-xs",
                  u.is_base ? "bg-blue-50 border-blue-100" : "bg-white border-slate-100"
                )}>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-700">{u.name}</span>
                    <span className="text-[10px] text-slate-400">المعامل: {u.conversion_factor}</span>
                  </div>
                  {u.is_base && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">أساسية</span>}
                  {u.barcode && <span className="text-[9px] font-mono text-slate-400">{u.barcode}</span>}
                </div>
              ))}
            </div>
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
            <FieldLabel required>اسم المادة</FieldLabel>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="اسم المادة" className="bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FieldLabel>الكود</FieldLabel>
              <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="توليد تلقائي" className="bg-white font-mono text-xs" dir="ltr" />
            </div>
            <div className="space-y-1">
              <FieldLabel>الباركود</FieldLabel>
              <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="000000" className="bg-white font-mono text-xs" dir="ltr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FieldLabel className="flex items-center gap-1.5"><Scale className="w-3.5 h-3.5 text-slate-400" /> الوحدة الأساسية</FieldLabel>
              <Input value={baseUnitName} onChange={e => setBaseUnitName(e.target.value)} placeholder="قطعة" className="bg-white" disabled={formMode === "edit_mat"} />
            </div>
            <div className="space-y-1">
              <FieldLabel>الحد الأدنى</FieldLabel>
              <Input type="number" value={minimumStock} onChange={e => setMinimumStock(e.target.value)} className="bg-white" />
            </div>
          </div>
        </>
      ) : formMode === "create_unit" ? (
        <>
          <div className="space-y-1">
            <FieldLabel required>اسم الوحدة</FieldLabel>
            <Input value={unitName} onChange={e => setUnitName(e.target.value)} placeholder="مثلاً: طرد، كرتونة..." className="bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FieldLabel required>معامل التعبئة</FieldLabel>
              <Input type="number" value={unitFactor} onChange={e => setUnitFactor(e.target.value)} placeholder="مثلاً: 12" className="bg-white font-bold" min="0.000001" step="any" />
            </div>
            <div className="space-y-1">
              <FieldLabel>الباركود</FieldLabel>
              <Input value={unitBarcode} onChange={e => setUnitBarcode(e.target.value)} placeholder="اختياري" className="bg-white font-mono text-xs" dir="ltr" />
            </div>
          </div>
          <div className="bg-blue-50 rounded-md p-3 border border-blue-100 flex items-center gap-3">
            <Package className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-[10px] text-blue-400 font-bold uppercase">إضافة للمادة</p>
              <p className="text-xs font-bold text-blue-700">{materialData?.name}</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <FieldLabel>اسم التصنيف</FieldLabel>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: ساعات" className="bg-white" disabled={isUncategorized && formMode === "edit_cat"} />
          </div>
          <div className="space-y-1">
            <FieldLabel>{!parentId || isRoot ? "بادئة التصنيف الفرعي العام" : "بادئة الكود"}</FieldLabel>
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
      canDelete={canDelete && !isUncategorized && !isMaterial}
      formPanel={formPanel}
      disableNew={false}
      newButtonLabel={isMaterial ? "إضافة وحدة قياس" : (isSubCategory || isUncategorized ? "مادة جديدة" : "تصنيف جديد")}
    >
      {detailsView}
    </TreeSidebar>
  );
}
