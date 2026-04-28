import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { RefreshCw, Folders, Package, Shuffle, Type, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { categoryService } from "@/services/categoryService";
import { materialService } from "@/services/materialService";
import type { CategoryDto, MaterialDto } from "@erp/shared-types";
import { TreeLayout } from "../components/erp/tree-management/TreeLayout";
import { CategoryTreeNodeItem } from "./categories/CategoryTreeNodeItem";
import { CategoryDetailsSidebar } from "./categories/CategoryDetailsSidebar";
import { Badge } from "@/components/ui/badge";

const DEFAULT_CATEGORY_NAME = "غير مصنف";
const VIRTUAL_ROOT_ID = "__categories_root__";

interface CategoryTreeNode extends CategoryDto {
  children: CategoryTreeNode[];
}

function buildTree(cats: CategoryDto[], materials: MaterialDto[]): CategoryTreeNode {
  const map = new Map<string, CategoryTreeNode>();
  
  // 1. Initialize map with all non-hybrid categories
  const normalCats = cats.filter(c => !c.is_hybrid);
  normalCats.forEach(c => map.set(c.id, { ...c, children: [] }));
  
  // 2. Attach materials as "virtual children" to categories
  materials.forEach(m => {
    const categoryIds = m.category_ids || [];
    
    if (categoryIds.length === 0) {
      // Uncategorized material
      const uncategorized = normalCats.find(c => c.name === DEFAULT_CATEGORY_NAME && !c.parent_id);
      if (uncategorized) {
        const node = map.get(uncategorized.id);
        if (node) {
          node.children.push({
            id: `mat-${m.id}`,
            name: m.name,
            code_prefix: m.code, // Hack to pass code through existing prop or handle in renderer
            is_hybrid: false,
            is_active: true,
            material_count: 0,
            parent_id: uncategorized.id,
            created_at: "",
            updated_at: "",
            children: [],
            isMaterial: true // Custom flag for renderer
          } as any);
        }
      }
    } else {
      // Material with categories
      categoryIds.forEach(catId => {
        const node = map.get(catId);
        if (node) {
          node.children.push({
            id: `mat-${m.id}`,
            name: m.name,
            code_prefix: m.code,
            is_hybrid: false,
            is_active: true,
            material_count: 0,
            parent_id: catId,
            created_at: "",
            updated_at: "",
            children: [],
            isMaterial: true
          } as any);
        }
      });
    }
  });

  // 3. Build the hierarchical structure
  const rootChildren: CategoryTreeNode[] = [];
  const uncategorizedNode = normalCats.find(c => c.name === DEFAULT_CATEGORY_NAME && !c.parent_id);
  
  normalCats.forEach(c => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      const parent = map.get(c.parent_id);
      if (parent) parent.children.push(node);
    } else if (c.id !== uncategorizedNode?.id) {
      rootChildren.push(node);
    }
  });

  // 4. Create virtual root
  const virtualRoot: CategoryTreeNode = {
    id: VIRTUAL_ROOT_ID,
    name: "التصنيفات",
    parent_id: null,
    is_active: true,
    is_hybrid: false,
    material_count: 0,
    code_prefix: null,
    created_at: "",
    updated_at: "",
    children: []
  };

  if (uncategorizedNode && map.has(uncategorizedNode.id)) {
    virtualRoot.children.push(map.get(uncategorizedNode.id)!);
  }
  
  virtualRoot.children.push(...rootChildren);
  
  return virtualRoot;
}

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

  const tree = useMemo(() => buildTree(categories, materials), [categories, materials]);
  const hybridCategories = useMemo(() => categories.filter(c => c.is_hybrid), [categories]);
  
  const filteredTree = useMemo(() => {
    if (!search) return tree;
    const filterNode = (node: CategoryTreeNode): CategoryTreeNode | null => {
      const filteredChildren = node.children.map(filterNode).filter(Boolean) as CategoryTreeNode[];
      const matches = node.name.includes(search);
      if (matches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };
    return filterNode(tree) || { ...tree, children: [] };
  }, [tree, search]);

  const toggleExpand = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!selected || selected.id === VIRTUAL_ROOT_ID) return;
    if (selected.name === DEFAULT_CATEGORY_NAME) {
      toast.error(`لا يمكن حذف التصنيف الافتراضي "${DEFAULT_CATEGORY_NAME}"`);
      return;
    }
    if ((selected.material_count ?? 0) > 0) {
      toast.error("لا يمكن حذف تصنيف يحتوي على مواد");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف "${selected.name}"؟`)) return;
    try {
      setLoading(true);
      await categoryService.deleteCategory(selected.id);
      toast.success("تم الحذف");
      setSelected(null);
      await fetchData(true);
    } catch (error) { toast.error("فشل الحذف: " + error); }
    finally { setLoading(false); }
  };

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Folders className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">{categories.filter(c => !c.is_hybrid).length}</div>
            <div className="text-xs text-muted-foreground">التصنيفات العادية</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
            <Shuffle className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-purple-600">{hybridCategories.length}</div>
            <div className="text-xs text-muted-foreground">التصنيفات الهجينة</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <Package className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-emerald-600">{materials.length}</div>
            <div className="text-xs text-muted-foreground">إجمالي المواد</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
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
                selected={selected?.id === VIRTUAL_ROOT_ID || selected?.id.startsWith('mat-') ? null : (selected as any)}
                allCategories={categories}
                parentName={parentName}
                onSaved={() => void fetchData(false)}
                onDelete={handleDelete}
                isVirtualRootSelected={selected?.id === VIRTUAL_ROOT_ID}
              />
            }
          />
        </div>

        {/* Hybrid Categories Section */}
        <div className="space-y-4">
          <Card className="p-5 border-purple-100 bg-purple-50/10 h-fit sticky top-6">
            <h3 className="text-sm font-bold text-purple-800 flex items-center gap-2 mb-4">
              <Shuffle className="w-4 h-4" />
              التصنيفات الهجينة
            </h3>
            
            {hybridCategories.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">لا توجد تصنيفات هجينة حالياً.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {hybridCategories.map(cat => {
                  const catMaterials = materials.filter(m => m.category_ids?.includes(cat.id));
                  return (
                    <div key={cat.id} className="bg-white border border-purple-100 rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-purple-50/50 px-3 py-2 border-b border-purple-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-xs font-bold text-purple-900 truncate">{cat.name}</span>
                          {cat.code_prefix && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 border-purple-200 bg-purple-50 text-purple-600 font-mono">
                              {cat.code_prefix}
                            </Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-[9px] bg-purple-100 text-purple-700">
                          {catMaterials.length} مادة
                        </Badge>
                      </div>
                      <div className="p-2 space-y-1">
                        {catMaterials.length === 0 ? (
                          <p className="text-[10px] text-slate-400 text-center py-2 italic">لا توجد مواد بعد</p>
                        ) : (
                          catMaterials.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-1.5 rounded-md hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <Package className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="text-[11px] text-slate-700 truncate">{m.name}</span>
                              </div>
                              <span className="text-[9px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                {m.code}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
