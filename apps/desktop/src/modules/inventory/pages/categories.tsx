import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, Scale } from "lucide-react";
import { toast } from "sonner";
import { categoryService } from '@modules/inventory/api/categoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { CreateMaterialRequest, UpdateMaterialRequest } from "@erp/shared-types";


// Refactored Components & Hooks
import { HierarchicalTreeTemplate } from '@widgets/templates/HierarchicalTreeTemplate';
import { Button } from "@shared/ui/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { CategoryTreeNodeItem } from "./categories/CategoryTreeNodeItem";
import { CategoryForm } from "./categories/CategoryForm";
import { CategoryDetailsPanel } from "./categories/CategoryDetailsPanel";
import { CategoryDeleteDialog, type CategoryDeleteKind } from "./categories/CategoryDeleteDialog";
import { MaterialForm } from "@modules/inventory/components/MaterialForm";
import { MaterialUnitsManager } from "@modules/inventory/components/MaterialUnitsManager";
import { MaterialDetailPanel } from "@modules/inventory/components/MaterialDetailPanel";
import { useCategoryTree, VIRTUAL_ROOT_ID, type CategoryTreeNode } from '@modules/inventory/hooks/useCategoryTree';
import { useCategories } from "@shared/hooks/queries/useCategoryQueries";
import { useMaterials } from "@shared/hooks/queries/useMaterialQueries";
import { QUERY_KEYS, INVENTORY_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";

const DEFAULT_CATEGORY_NAME = "غير مصنف";

/** What the side panel should render for the current selection. */
type PanelAction =
  | { kind: "view" }
  | { kind: "create_category"; parentId: string | null }
  | { kind: "edit_category" }
  | { kind: "create_material"; categoryId: string | null }
  | { kind: "edit_material" }
  | { kind: "manage_units" }
  | null;

export default function Categories() {
  const queryClient = useQueryClient();
  const { data: categoriesData = [], isLoading: categoriesLoading } = useCategories();
  const { data: materialsData = [] } = useMaterials();
  const categories = useMemo(() => categoriesData, [categoriesData]);
  const materials = useMemo(() => materialsData, [materialsData]);
  const isLoading = categoriesLoading;

  const [search] = useState("");
  const [selected, setSelected] = useState<CategoryTreeNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set([VIRTUAL_ROOT_ID]));
  const [panelAction, setPanelAction] = useState<PanelAction>(null);

  // Category delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteKind, setDeleteKind] = useState<CategoryDeleteKind | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<{
    id: string;
    name: string;
    targetId: string;
  } | null>(null);

  // Material delete confirm state
  const [materialDeleteOpen, setMaterialDeleteOpen] = useState(false);
  const [materialDeleteTarget, setMaterialDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [materialSaving, setMaterialSaving] = useState(false);

  const hasLoadedOnceRef = useRef(false);
  const { filteredTree } = useCategoryTree(categories, materials, search);

  // Expand all root categories on first successful load
  useEffect(() => {
    if (!hasLoadedOnceRef.current && categories.length > 0) {
      hasLoadedOnceRef.current = true;
      const rootIds = categories.filter(c => !c.parent_id && !c.is_hybrid).map(c => c.id);
      setExpandedIds(new Set([VIRTUAL_ROOT_ID, ...rootIds]));
    }
  }, [categories]);

  // Keep the selected node in sync with fresh query data
  useEffect(() => {
    setSelected(prev => {
      if (!prev) return prev;
      if (prev.isMaterial) {
        const fresh = materials.find(m => m.id === prev.materialData?.id);
        if (!fresh || fresh === prev.materialData) return prev;
        return { ...prev, name: fresh.name, code_prefix: fresh.code, materialData: fresh };
      }
      if (prev.id === VIRTUAL_ROOT_ID) return prev;
      const fresh = categories.find(c => c.id === prev.id);
      if (!fresh) return prev;
      if (
        prev.name === fresh.name &&
        (prev.code_prefix || null) === (fresh.code_prefix || null) &&
        prev.parent_id === fresh.parent_id &&
        prev.material_count === fresh.material_count &&
        prev.is_active === fresh.is_active
      ) {
        return prev;
      }
      return { ...prev, ...fresh, children: prev.children };
    });
  }, [categories, materials]);

  const toggleExpand = useCallback((id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set([VIRTUAL_ROOT_ID, ...categories.map(c => c.id)]));
  }, [categories]);

  const collapseAll = useCallback(() => setExpandedIds(new Set([VIRTUAL_ROOT_ID])), []);

  const isRootSelected = selected?.id === VIRTUAL_ROOT_ID;
  const isMaterialSelected = !!selected?.isMaterial;
  const isUncategorizedSelected = !!selected && !selected.isMaterial && selected.name === DEFAULT_CATEGORY_NAME;
  const canOperate = !!selected && !isRootSelected;
  const canDelete = canOperate && !isUncategorizedSelected;

  const newButtonLabel = !!selected?.parent_id || isUncategorizedSelected ? "مادة جديدة" : "تصنيف جديد";

  const handleSelect = useCallback((node: CategoryTreeNode) => {
    setSelected(node);
    if (node.id === VIRTUAL_ROOT_ID) setPanelAction(null);
    else setPanelAction({ kind: "view" });
  }, []);

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

  const handleOpenNew = useCallback(() => {
    if (isMaterialSelected) {
      setPanelAction({ kind: "manage_units" });
      return;
    }
    if (!selected || selected.id === VIRTUAL_ROOT_ID) {
      setPanelAction({ kind: "create_category", parentId: null });
      return;
    }
    if (!!selected.parent_id || isUncategorizedSelected) {
      setPanelAction({ kind: "create_material", categoryId: selected.id });
      return;
    }
    setPanelAction({ kind: "create_category", parentId: selected.id });
  }, [selected, isMaterialSelected, isUncategorizedSelected]);

  const handleOpenEdit = useCallback(() => {
    if (!canOperate) return;
    if (selected?.isMaterial) setPanelAction({ kind: "edit_material" });
    else setPanelAction({ kind: "edit_category" });
  }, [canOperate, selected]);

  const handleOpenUnits = useCallback(() => {
    if (!isMaterialSelected) return;
    setPanelAction({ kind: "manage_units" });
  }, [isMaterialSelected]);

  const handleDeleteRequest = useCallback(() => {
    if (!canOperate) return;
    if (selected?.isMaterial) {
      const id = selected.id.replace('mat-', '');
      setMaterialDeleteTarget({ id, name: selected.name });
      setMaterialDeleteOpen(true);
      return;
    }
    if (selected.name === DEFAULT_CATEGORY_NAME) {
      toast.error(`لا يمكن حذف التصنيف الافتراضي "${DEFAULT_CATEGORY_NAME}"`);
      return;
    }
    const kind = computeDeleteKind(selected);
    const targetId = computeReassignTargetId(selected);
    if (!kind || !targetId) {
      toast.error("تعذر تحديد إجراء الحذف");
      return;
    }
    setDeleteKind(kind);
    setPendingCategoryDelete({ id: selected.id, name: selected.name, targetId });
    setDeleteOpen(true);
  }, [canOperate, selected, computeDeleteKind, computeReassignTargetId]);

  const handleConfirmCategoryDelete = useCallback(async () => {
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
      await invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
      setDeleteOpen(false);
      setDeleteKind(null);
      setPendingCategoryDelete(null);
      setSelected(null);
      setPanelAction(null);
    } catch (error) {
      toast.error("فشل الحذف: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setDeleting(false);
    }
  }, [pendingCategoryDelete, deleteKind, queryClient]);

  const handleCancelCategoryDelete = useCallback(() => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteKind(null);
    setPendingCategoryDelete(null);
  }, [deleting]);

  const handleConfirmMaterialDelete = useCallback(async () => {
    if (!materialDeleteTarget) return;
    setDeleting(true);
    try {
      await materialService.delete(materialDeleteTarget.id);
      await invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
      toast.success("تم الحذف بنجاح");
      setMaterialDeleteOpen(false);
      setMaterialDeleteTarget(null);
      setSelected(null);
      setPanelAction(null);
    } catch (error) {
      toast.error("فشل الحذف: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setDeleting(false);
    }
  }, [materialDeleteTarget, queryClient]);

  const handleSaveMaterial = useCallback(async (data: CreateMaterialRequest | UpdateMaterialRequest) => {
    setMaterialSaving(true);
    try {
      const update = data as UpdateMaterialRequest;
      if (update.id) {
        await materialService.update(update);
        toast.success("تم تحديث المادة");
      } else {
        await materialService.create(data as CreateMaterialRequest);
        toast.success("تمت إضافة المادة");
      }
      await invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
      setPanelAction(selected && selected.id !== VIRTUAL_ROOT_ID ? { kind: "view" } : null);
    } catch (error) {
      toast.error("فشل الحفظ: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setMaterialSaving(false);
    }
  }, [queryClient, selected]);

  const handleCategorySaved = useCallback(async () => {
    await invalidateKeys(queryClient, [QUERY_KEYS.categories]);
    setPanelAction(selected && selected.id !== VIRTUAL_ROOT_ID ? { kind: "view" } : null);
  }, [queryClient, selected]);

  const handleCategoryCreated = useCallback(() => {
    void invalidateKeys(queryClient, [QUERY_KEYS.categories]);
  }, [queryClient]);

  const handleUnitsUpdated = useCallback(() => {
    void invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
  }, [queryClient]);

  // TopBar / external "add new" entry point
  useEffect(() => {
    const handler = () => handleOpenNew();
    window.addEventListener("erp:open-new-category", handler);
    return () => window.removeEventListener("erp:open-new-category", handler);
  }, [handleOpenNew]);

  const isPanelOpen = panelAction !== null;
  const panelSelected = isRootSelected ? null : selected;

  const renderSidebar = () => {
    switch (panelAction?.kind) {
      case "view":
        if (!panelSelected) return null;
        if (panelSelected.isMaterial) {
          return (
            <MaterialDetailPanel
              material={panelSelected.materialData ?? null}
              onClose={() => setPanelAction(null)}
              onEdit={() => setPanelAction({ kind: "edit_material" })}
              onDelete={handleDeleteRequest}
              initialTab="units"
            />
          );
        }
        return (
          <CategoryDetailsPanel
            category={panelSelected}
            prefix={
              panelSelected.code_prefix ??
              categories.find(c => c.parent_id === panelSelected.id && c.name.endsWith("عام"))?.code_prefix ??
              undefined
            }
          />
        );
      case "create_category":
        return (
          <CategoryForm
            open
            mode="create_cat"
            selected={null}
            parentId={panelAction.parentId}
            allCategories={categories}
            onClose={() => setPanelAction(null)}
            onSaved={handleCategorySaved}
          />
        );
      case "edit_category":
        return (
          <CategoryForm
            open
            mode="edit_cat"
            selected={panelSelected && !panelSelected.isMaterial ? panelSelected : null}
            parentId={panelSelected?.parent_id ?? null}
            allCategories={categories}
            onClose={() => setPanelAction(null)}
            onSaved={handleCategorySaved}
          />
        );
      case "create_material":
        return (
          <MaterialForm
            open
            material={null}
            categories={categories}
            initialCategoryId={panelAction.categoryId}
            onSave={handleSaveMaterial}
            saving={materialSaving}
            onClose={() => setPanelAction(null)}
            onCategoryCreated={handleCategoryCreated}
          />
        );
      case "edit_material":
        return (
          <MaterialForm
            open
            material={panelSelected?.materialData ?? null}
            categories={categories}
            onSave={handleSaveMaterial}
            saving={materialSaving}
            onClose={() => setPanelAction(null)}
            onCategoryCreated={handleCategoryCreated}
          />
        );
      case "manage_units":
        return (
          <MaterialUnitsManager
            material={panelSelected?.materialData ?? null}
            onClose={() => setPanelAction(null)}
            onUnitsUpdated={handleUnitsUpdated}
          />
        );
      default:
        return null;
    }
  };

  return (
    <HierarchicalTreeTemplate
      title="تصنيفات المواد"
      toolbar={
        <>
          {isMaterialSelected ? (
            <Button size="sm" onClick={handleOpenUnits} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
              <Scale className="w-4 h-4 ml-2" /> الوحدات
            </Button>
          ) : (
            <Button size="sm" onClick={handleOpenNew} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
              <Plus className="w-4 h-4 ml-2" /> {newButtonLabel}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!canOperate}
            onClick={handleOpenEdit}
          >
            <Edit className="w-4 h-4 ml-2" /> تعديل
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white border-rose-200 text-rose-700 hover:bg-rose-50"
            disabled={!canDelete}
            onClick={handleDeleteRequest}
          >
            <Trash2 className="w-4 h-4 ml-2 text-rose-600" /> حذف
          </Button>
        </>
      }
      treeHeaderActions={
        <>
          <button
            onClick={expandAll}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> توسيع
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
          >
            طي <ChevronRight className="w-3 h-3" />
          </button>
        </>
      }
      treeContent={
        <div className="space-y-1">
          {isLoading ? (
             Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-lg mb-2" />
            ))
          ) : (
            <CategoryTreeNodeItem
              key={filteredTree.id}
              node={filteredTree}
              selectedId={selected?.id || ""}
              onSelect={handleSelect}
              expandedNodes={expandedIds}
              onToggle={toggleExpand}
            />
          )}
        </div>
      }
      sidePanel={isPanelOpen ? renderSidebar() : undefined}
      isPanelOpen={isPanelOpen}
    >
      <CategoryDeleteDialog
        open={deleteOpen}
        kind={deleteKind}
        categoryName={pendingCategoryDelete?.name ?? ""}
        onCancel={handleCancelCategoryDelete}
        onConfirm={handleConfirmCategoryDelete}
        confirming={deleting}
      />
      <ConfirmDialog
        open={materialDeleteOpen}
        onOpenChange={setMaterialDeleteOpen}
        title="حذف المادة"
        description={materialDeleteTarget ? `هل تريد حذف المادة «${materialDeleteTarget.name}»؟` : undefined}
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        destructive
        onConfirm={() => void handleConfirmMaterialDelete()}
      />
    </HierarchicalTreeTemplate>
  );
}