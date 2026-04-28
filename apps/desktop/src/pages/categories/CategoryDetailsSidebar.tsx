import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Shuffle } from "lucide-react";
import type { CategoryDto } from "@erp/shared-types";
import { categoryService } from "@/services/categoryService";
import { TreeSidebar } from "../../components/erp/tree-management/TreeSidebar";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface CategoryDetailsSidebarProps {
  selected: CategoryDto | null;
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
  const navigate = useNavigate();
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [codePrefix, setCodePrefix] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUncategorized = selected?.name === DEFAULT_CATEGORY_NAME;
  const isSubCategory = !!selected?.parent_id;
  const isRoot = selected && !selected.parent_id && !isUncategorized;

  // Find the prefix of the "General" sub-category for the current root
  const getGeneralSubPrefix = useCallback((rootId: string) => {
    const generalSub = allCategories.find(c => c.parent_id === rootId && c.name.endsWith("عام"));
    return generalSub?.code_prefix || "";
  }, [allCategories]);

  useEffect(() => {
    setFormMode(null);
    setError(null);
    if (selected) {
      setName(selected.name);
      setParentId(selected.parent_id || null);
      
      if (isUncategorized && !selected.code_prefix) {
        setCodePrefix("غ");
      } else if (isRoot) {
        // If it's a root, show the prefix of its general sub-category
        setCodePrefix(getGeneralSubPrefix(selected.id));
      } else {
        setCodePrefix(selected.code_prefix || "");
      }
    } else {
      setName("");
      setParentId(null);
      setCodePrefix("");
    }
  }, [selected, isVirtualRootSelected, isRoot, getGeneralSubPrefix]);

  const suggestPrefix = useCallback(() => {
    const chars = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي";
    const existingPrefixes = new Set(allCategories.map(c => c.code_prefix).filter(Boolean));
    for (const char of chars) {
      if (!existingPrefixes.has(char)) return char;
    }
    return "X"; 
  }, [allCategories]);

  const openCreate = () => {
    if (isSubCategory || isUncategorized) {
       // Navigate to New Material instead
       navigate(`/materials?categoryId=${selected?.id}`);
       return;
    }
    setFormMode("create");
    setError(null);
    setName("");
    setParentId(selected?.id || null);
    setCodePrefix(suggestPrefix());
  };

  const openEdit = () => {
    if (!selected || !canEdit) return;
    setFormMode("edit");
    setError(null);
    setName(selected.name);
    setParentId(selected.parent_id || null);
    if (isRoot) {
      setCodePrefix(getGeneralSubPrefix(selected.id));
    } else {
      setCodePrefix(selected.code_prefix || "");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("الاسم مطلوب");
      return;
    }

    if (codePrefix.trim().length === 0 && (formMode === "create" || isUncategorized)) {
       setError("بادئة الكود مطلوبة.");
       return;
    }

    if (codePrefix.trim()) {
      const existing = allCategories.find(c => 
        c.code_prefix?.toUpperCase() === codePrefix.trim().toUpperCase() && 
        c.id !== (isRoot ? allCategories.find(sub => sub.parent_id === selected?.id && sub.name.endsWith("عام"))?.id : selected?.id)
      );
      if (existing) {
        setError(`البادئة "${codePrefix}" مستخدمة بالفعل في تصنيف "${existing.name}"`);
        return;
      }
    }

    setSaving(true);
    try {
      if (formMode === "edit" && selected) {
        if (isRoot) {
          // Update root name and its general sub prefix
          await categoryService.updateCategory({
            id: selected.id,
            name: name.trim(),
            parent_id: undefined,
            is_active: selected.is_active,
            code_prefix: null, // Root never has a prefix
          });
          
          const generalSub = allCategories.find(c => c.parent_id === selected.id && c.name.endsWith("عام"));
          if (generalSub) {
            await categoryService.updateCategory({
              id: generalSub.id,
              name: `${name.trim()} عام`,
              parent_id: selected.id,
              is_active: generalSub.is_active,
              code_prefix: codePrefix.trim().toUpperCase(),
            });
          }
        } else {
          await categoryService.updateCategory({
            id: selected.id,
            name: name.trim(),
            parent_id: parentId || undefined,
            is_active: selected.is_active,
            code_prefix: codePrefix.trim().toUpperCase() || null,
          });
        }
        toast.success("تم التحديث بنجاح");
      } else {
        await categoryService.createCategory({
          name: name.trim(),
          parent_id: parentId || undefined,
          code_prefix: codePrefix.trim().toUpperCase() || null,
        });
        toast.success("تمت الإضافة بنجاح");
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
    <>
      {!selected ? (
        isVirtualRootSelected ? (
          <div className="grid gap-3">
            <div className="rounded-md border bg-primary/5 p-3">
              <p className="text-[11px] text-primary mb-1">اسم العنصر</p>
              <p className="font-semibold text-primary">شجرة التصنيفات (الجذر)</p>
            </div>
            <p className="text-[11px] text-slate-500">يمكنك إضافة تصنيفات رئيسية جديدة من هنا.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">اختر تصنيفاً من الشجرة لعرض التفاصيل.</p>
        )
      ) : (
        <div className="grid gap-3">
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500 mb-1">اسم التصنيف</p>
            <p className="font-semibold text-slate-800">{selected.name}</p>
          </div>
          {codePrefix && (
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500 mb-1">{isRoot ? "بادئة التصنيف الفرعي العام" : "بادئة الكود"}</p>
              <p className="font-semibold tabular-nums text-slate-800">{codePrefix}</p>
            </div>
          )}
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500 mb-1">فرعي من</p>
            <p className="font-semibold text-slate-800">
              {parentName && parentName.trim().length > 0 ? parentName : "تصنيف رئيسي"}
            </p>
          </div>
        </div>
      )}
    </>
  );

  const formPanel = (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-md px-3 py-2 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-1">
        <Label>اسم التصنيف</Label>
        <Input 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="مثال: ساعات" 
          className="bg-white" 
          disabled={isUncategorized && formMode === "edit"}
        />
      </div>

      <div className="space-y-1">
        <Label>{!parentId || isRoot ? "بادئة التصنيف الفرعي العام" : "بادئة الكود"}</Label>
        <div className="flex gap-2">
          <Input 
            value={codePrefix} 
            onChange={(e) => setCodePrefix(e.target.value.slice(0, 1).toUpperCase())} 
            placeholder="A" 
            className="bg-white font-mono text-center"
            maxLength={1}
          />
          <Button variant="outline" size="icon" className="flex-shrink-0" onClick={() => setCodePrefix(suggestPrefix())} title="اقتراح بادئة">
            <Shuffle className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-slate-400">
          {!parentId || isRoot
            ? "هذه البادئة ستخصص للتصنيف الفرعي الافتراضي المرتبط بهذا التصنيف الرئيسي."
            : "تستخدم لتوليد أكواد المواد تلقائياً."}
        </p>
      </div>

      <div className="space-y-1">
        <Label>فرعي من</Label>
        <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {parentId === null 
            ? "-- تصنيف رئيسي (مستوى أول) --" 
            : (() => {
                const parent = allCategories.find(c => c.id === parentId);
                return parent ? parent.name : (parentName || "--");
              })()}
        </div>
      </div>

      {formMode === "create" && !parentId && name && (
        <div className="text-[10px] text-blue-600 bg-blue-50 rounded-md p-2 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          سيُنشأ تلقائياً: «{name} عام» بالبادئة المحددة أعلاه.
        </div>
      )}
    </div>
  );

  return (
    <TreeSidebar
      title={formMode === "create" ? "إضافة تصنيف" : formMode === "edit" ? "تعديل تصنيف" : "تفاصيل التصنيف"}
      selected={selected}
      formMode={formMode}
      onOpenCreate={openCreate}
      onOpenEdit={openEdit}
      onDelete={onDelete}
      onCancel={() => setFormMode(null)}
      onSave={handleSave}
      saving={saving}
      canEdit={canEdit}
      canDelete={canDelete && !isUncategorized && (selected?.material_count || 0) === 0}
      formPanel={formPanel}
      disableNew={isUncategorized || isSubCategory}
      newButtonLabel={isUncategorized || isSubCategory ? "مادة جديدة" : undefined}
    >
      {detailsView}
    </TreeSidebar>
  );
}
