import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search, Plus, ChevronLeft, ChevronRight, BarChart3, Folder } from "lucide-react";
import { toast } from "sonner";
import { categoryService } from '@modules/inventory/api/categoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { CategoryDto, MaterialDto } from "@erp/shared-types";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";

// Refactored Components & Hooks
import { HierarchicalTreeTemplate } from '@widgets/templates/HierarchicalTreeTemplate';
import { CategoryTreeNodeItem } from "./categories/CategoryTreeNodeItem";
import { CategoryDetailsSidebar } from "./categories/CategoryDetailsSidebar";
import { useCategoryTree, VIRTUAL_ROOT_ID, type CategoryTreeNode } from '@modules/inventory/hooks/useCategoryTree';

const DEFAULT_CATEGORY_NAME = "غير مصنف";

export default function Categories() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
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

  const isLoading = loading || refreshing;

  return (
    <HierarchicalTreeTemplate
      title="تصنيفات المواد"
      toolbar={
        <>
          <div className="relative w-64 ml-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="بحث في التصنيفات والمواد..." 
              className="pr-10 h-10 border-slate-200 bg-slate-50/50" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchData(false)} disabled={isLoading} className="bg-white">
            <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin" : ""}`} /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpandedIds(new Set([VIRTUAL_ROOT_ID, ...categories.map(c => c.id)]))} className="bg-white">
            <ChevronLeft className="w-4 h-4 ml-1" /> توسيع الكل
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpandedIds(new Set([VIRTUAL_ROOT_ID]))} className="bg-white">
             طي الكل <ChevronRight className="w-4 h-4 mr-1" />
          </Button>
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
          parentName={parentName}
          onSaved={() => void fetchData(false)}
          onDelete={handleDelete}
          isVirtualRootSelected={selected?.id === VIRTUAL_ROOT_ID}
        />
      }
      extraContent={
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {[
             { label: "إجمالي التصنيفات", value: categories.length, color: "text-slate-900", icon: Folder },
             { label: "إجمالي المواد", value: materials.length, color: "text-blue-600", icon: BarChart3 },
             { label: "تصنيفات نشطة", value: categories.length, color: "text-emerald-600", icon: RefreshCw },
           ].map((stat, i) => (
             <div key={i} className="bg-slate-50/50 rounded-xl p-6 border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
                  <stat.icon className="w-4 h-4 text-slate-300" />
                </div>
                <div className={`text-3xl font-black tabular-nums ${stat.color}`}>{stat.value}</div>
             </div>
           ))}
        </div>
      }
    />
  );
}
