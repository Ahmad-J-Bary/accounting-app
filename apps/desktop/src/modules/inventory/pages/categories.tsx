import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { categoryService } from '@modules/inventory/api/categoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { CategoryDto, MaterialDto } from "@erp/shared-types";


// Refactored Components & Hooks
import { HierarchicalTreeTemplate } from '@widgets/templates/HierarchicalTreeTemplate';
import { CategoryTreeNodeItem } from "./categories/CategoryTreeNodeItem";
import { CategoryDetailsSidebar } from "./categories/CategoryDetailsSidebar";
import { useCategoryTree, VIRTUAL_ROOT_ID, type CategoryTreeNode } from '@modules/inventory/hooks/useCategoryTree';
import { CategoryDeleteDialog, type CategoryDeleteKind } from "./categories/CategoryDeleteDialog";

const DEFAULT_CATEGORY_NAME = "غير مصنف";

export default function Categories() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setRefreshing] = useState(false);
  const [search] = useState("");
  const [selected, setSelected] = useState<CategoryTreeNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set([VIRTUAL_ROOT_ID]));

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const [catData, matData] = await Promise.all([
        categoryService.listCategories(),
        materialService.listMaterials(),
      ]);
      setCategories(catData);
      setMaterials(matData);
      if (isInitial) {
        const rootIds = catData.filter(c => !c.parent_id && !c.is_hybrid).map(c => c.id);
        setExpandedIds(new Set([VIRTUAL_ROOT_ID, ...rootIds]));
      }
    } catch (error) { toast.error("فشل جلب البيانات: " + error); }
    finally { 
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchData(true); }, [fetchData]);

  const { filteredTree } = useCategoryTree(categories, materials, search);
  
  const toggleExpand = useCallback((id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteKind, setDeleteKind] = useState<CategoryDeleteKind | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<{
    id: string;
    name: string;
    targetId: string;
  } | null>(null);

  /** Build a `CategoryDeleteKind` from the currently selected node. */
  const computeDeleteKind = useCallback((node: CategoryTreeNode): CategoryDeleteKind | null => {
    if (node.id === VIRTUAL_ROOT_ID) return null;
    if (node.isMaterial) return null; // handled by material flow

    const id = node.id;
    const isRoot = !node.parent_id && node.name !== DEFAULT_CATEGORY_NAME;

    if (isRoot) {
      const subs = categories.filter(c => c.parent_id === id);
      const subMaterialCount = subs.reduce((s, c) => s + (c.material_count ?? 0), 0);
      if (subs.length === 0) return { type: "root_no_subs" };
      const defaultCat = categories.find(c => c.name === DEFAULT_CATEGORY_NAME);
      return {
        type: "root_with_subs",
        subCount: subs.length,
        subMaterialCount,
        targetName: defaultCat?.name || DEFAULT_CATEGORY_NAME,
      };
    }

    // Sub-category
    const materialCount = node.material_count ?? 0;
    if (materialCount === 0) return { type: "sub_empty" };

    const root = categories.find(c => c.id === node.parent_id);
    const isGeneralSub = !!root && node.name === `${root.name} عام`;

    if (isGeneralSub) {
      const defaultCat = categories.find(c => c.name === DEFAULT_CATEGORY_NAME);
      return {
        type: "sub_with_materials",
        materialCount,
        targetName: defaultCat?.name || DEFAULT_CATEGORY_NAME,
        isGeneralSub: true,
      };
    }

    const generalSub = root ? categories.find(c => c.parent_id === root.id && c.name === `${root.name} عام`) : undefined;
    if (generalSub) {
      return {
        type: "sub_with_materials",
        materialCount,
        targetName: generalSub.name,
        isGeneralSub: false,
      };
    }

    const defaultCat = categories.find(c => c.name === DEFAULT_CATEGORY_NAME);
    return {
      type: "sub_with_materials",
      materialCount,
      targetName: defaultCat?.name || DEFAULT_CATEGORY_NAME,
      isGeneralSub: true,
    };
  }, [categories]);

  /** Compute the target category id to receive reassigned materials. */
  const computeReassignTargetId = useCallback((node: CategoryTreeNode): string | null => {
    if (node.id === VIRTUAL_ROOT_ID || node.isMaterial) return null;

    const isRoot = !node.parent_id && node.name !== DEFAULT_CATEGORY_NAME;
    if (isRoot) {
      const defaultCat = categories.find(c => c.name === DEFAULT_CATEGORY_NAME);
      return defaultCat?.id ?? null;
    }

    const root = categories.find(c => c.id === node.parent_id);
    const isGeneralSub = !!root && node.name === `${root.name} عام`;

    if (isGeneralSub) {
      const defaultCat = categories.find(c => c.name === DEFAULT_CATEGORY_NAME);
      return defaultCat?.id ?? null;
    }

    const generalSub = root ? categories.find(c => c.parent_id === root.id && c.name === `${root.name} عام`) : undefined;
    if (generalSub) return generalSub.id;

    const defaultCat = categories.find(c => c.name === DEFAULT_CATEGORY_NAME);
    return defaultCat?.id ?? null;
  }, [categories]);

  const handleDelete = useCallback(() => {
    if (!selected || selected.id === VIRTUAL_ROOT_ID) return;

    // Material deletion keeps the existing flow.
    if (selected.isMaterial) {
      const id = selected.id.replace('mat-', '');
      if (!window.confirm(`هل أنت متأكد من حذف المادة "${selected.name}"؟`)) return;
      (async () => {
        try {
          setLoading(true);
          await materialService.deleteMaterial(id);
          toast.success("تم الحذف بنجاح");
          setSelected(null);
          await fetchData(false);
        } catch (error) {
          toast.error("فشل الحذف: " + error);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    if (selected.name === DEFAULT_CATEGORY_NAME) {
      toast.error(`لا يمكن حذف التصنيف الافتراضي "${DEFAULT_CATEGORY_NAME}"`);
      return;
    }

    const kind = computeDeleteKind(selected);
    const targetId = computeReassignTargetId(selected);

    if (!kind || !targetId) {
      if (!window.confirm(`هل تريد حذف "${selected.name}"؟`)) return;
      (async () => {
        try {
          setLoading(true);
          await categoryService.deleteCategory(selected.id);
          toast.success("تم الحذف بنجاح");
          setSelected(null);
          await fetchData(false);
        } catch (error) {
          toast.error("فشل الحذف: " + error);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    setDeleteKind(kind);
    setPendingCategoryDelete({ id: selected.id, name: selected.name, targetId });
    setDeleteOpen(true);
  }, [selected, computeDeleteKind, computeReassignTargetId, fetchData]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingCategoryDelete) return;
    setDeleting(true);
    try {
      if (deleteKind?.type === "sub_empty" || deleteKind?.type === "root_no_subs") {
        await categoryService.deleteCategory(pendingCategoryDelete.id);
        toast.success("تم الحذف بنجاح");
      } else {
        const result = await categoryService.deleteCategoryWithReassignment(
          pendingCategoryDelete.id,
          pendingCategoryDelete.targetId,
        );
        const parts: string[] = [];
        if (result.materials_reassigned > 0) {
          parts.push(`تم تعديل تصنيف ${result.materials_reassigned} مادة`);
        }
        if (result.subs_deleted > 0) {
          parts.push(`وحذف ${result.subs_deleted} تصنيف فرعي`);
        }
        const suffix = parts.length > 0 ? ` (${parts.join("، ")})` : "";
        toast.success(`تم الحذف بنجاح${suffix}`);
      }
      setDeleteOpen(false);
      setDeleteKind(null);
      setPendingCategoryDelete(null);
      setSelected(null);
      await fetchData(false);
    } catch (error) {
      toast.error("فشل الحذف: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setDeleting(false);
    }
  }, [pendingCategoryDelete, deleteKind, fetchData]);

  const handleCancelDelete = useCallback(() => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteKind(null);
    setPendingCategoryDelete(null);
  }, [deleting]);

  return (
    <>
      <HierarchicalTreeTemplate
      title="تصنيفات المواد"
      toolbar={<></>}
      treeHeaderActions={
        <>
          <button
            onClick={() => setExpandedIds(new Set([VIRTUAL_ROOT_ID, ...categories.map(c => c.id)]))}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> توسيع
          </button>
          <button
            onClick={() => setExpandedIds(new Set([VIRTUAL_ROOT_ID]))}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
          >
            طي <ChevronRight className="w-3 h-3" />
          </button>
        </>
      }
      treeSidebar={
        <div className="space-y-1">
          {loading ? (
             Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-lg mb-2" />
            ))
          ) : (
            <CategoryTreeNodeItem
              key={filteredTree.id}
              node={filteredTree}
              selectedId={selected?.id || ""}
              onSelect={setSelected}
              expandedNodes={expandedIds}
              onToggle={toggleExpand}
            />
          )}
        </div>
      }
      detailContent={
        <CategoryDetailsSidebar
          selected={selected?.id === VIRTUAL_ROOT_ID ? null : selected}
          allCategories={categories}
          onSaved={() => void fetchData(false)}
          onDelete={handleDelete}
          isVirtualRootSelected={selected?.id === VIRTUAL_ROOT_ID}
        />
      }
      />
      <CategoryDeleteDialog
        open={deleteOpen}
        kind={deleteKind}
        categoryName={pendingCategoryDelete?.name ?? ""}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        confirming={deleting}
      />
    </>
  );
}
