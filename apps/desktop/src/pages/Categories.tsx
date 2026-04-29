import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { categoryService } from "@/services/categoryService";
import { materialService } from "@/services/materialService";
import type { CategoryDto, MaterialDto } from "@erp/shared-types";

// Refactored Components & Hooks
import { TreeLayout } from "../components/erp/tree-management/TreeLayout";
import { CategoryTreeNodeItem } from "./categories/CategoryTreeNodeItem";
import { CategoryDetailsSidebar } from "./categories/CategoryDetailsSidebar";
import { CategoryStats } from "@/components/erp/categories/CategoryStats";
import { useCategoryTree, VIRTUAL_ROOT_ID, type CategoryTreeNode } from "@/hooks/useCategoryTree";

const DEFAULT_CATEGORY_NAME = "غير مصنف";

export default function Categories() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CategoryTreeNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set([VIRTUAL_ROOT_ID]));

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
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
    finally { if (isInitial) setLoading(false); }
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

  const handleDelete = useCallback(async () => {
    if (!selected || selected.id === VIRTUAL_ROOT_ID) return;
    
    const isMat = selected.isMaterial;
    const name = selected.name;
    const id = isMat ? selected.id.replace('mat-', '') : selected.id;

    if (!isMat) {
      if (name === DEFAULT_CATEGORY_NAME) {
        toast.error(`لا يمكن حذف التصنيف الافتراضي "${DEFAULT_CATEGORY_NAME}"`);
        return;
      }
      if ((selected.material_count ?? 0) > 0) {
        toast.error("لا يمكن حذف تصنيف يحتوي على مواد");
        return;
      }
    }

    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;

    try {
      setLoading(true);
      if (isMat) {
        await materialService.deleteMaterial(id);
      } else {
        await categoryService.deleteCategory(id);
      }
      toast.success("تم الحذف بنجاح");
      setSelected(null);
      await fetchData(false);
    } catch (error) { 
      toast.error("فشل الحذف: " + error); 
    } finally { 
      setLoading(false); 
    }
  }, [selected, fetchData]);

  const parentName = useMemo(() => {
    if (!selected?.parent_id) return null;
    return categories.find(c => c.id === selected.parent_id)?.name ?? null;
  }, [selected, categories]);

  const treeContent = (
    <>
      {loading ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p>جاري تحميل البيانات...</p>
        </div>
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
    </>
  );

  const tableHeader = (
    <>
      <div className="w-[40px]" />
      <div className="flex-1">الاسم (تصنيف / مادة)</div>
      <div className="w-[80px]">المواد</div>
      <div className="w-[80px]">الحالة</div>
    </>
  );

  return (
    <>
      <PageHeader
        title="تصنيفات المواد"
        subtitle="إدارة شجرة التصنيفات الهرمية والمواد الهجينة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "بطاقات المواد", to: "/materials" }, { label: "التصنيفات" }]}
      />

      <CategoryStats categories={categories} materials={materials} />

      <div className="mt-6">
        <TreeLayout
          searchQuery={search}
          onSearchChange={setSearch}
          onExpandAll={() => setExpandedIds(new Set([VIRTUAL_ROOT_ID, ...categories.map(c => c.id)]))}
          onCollapseAll={() => setExpandedIds(new Set([VIRTUAL_ROOT_ID]))}
          onRefresh={() => void fetchData(true)}
          loading={loading}
          tableHeader={tableHeader}
          treeContent={treeContent}
          sidebarContent={
            <CategoryDetailsSidebar
              selected={selected?.id === VIRTUAL_ROOT_ID ? null : selected}
              allCategories={categories}
              parentName={parentName}
              onSaved={() => void fetchData(false)}
              onDelete={handleDelete}
              isVirtualRootSelected={selected?.id === VIRTUAL_ROOT_ID}
            />
          }
        />
      </div>
    </>
  );
}
