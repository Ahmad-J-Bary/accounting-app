import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { RefreshCw, Folders } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { categoryService } from "@/services/categoryService";
import type { CategoryDto } from "@erp/shared-types";
import { TreeLayout } from "../components/erp/tree-management/TreeLayout";
import { CategoryTreeNodeItem } from "./categories/CategoryTreeNodeItem";
import { CategoryDetailsSidebar } from "./categories/CategoryDetailsSidebar";

const DEFAULT_CATEGORY_NAME = "غير مصنف";
const VIRTUAL_ROOT_ID = "__categories_root__";

interface CategoryTreeNode extends CategoryDto {
  children: CategoryTreeNode[];
}

function buildTree(cats: CategoryDto[]): CategoryTreeNode {
  const map = new Map<string, CategoryTreeNode>();
  cats.filter(c => !c.is_hybrid).forEach(c => map.set(c.id, { ...c, children: [] }));
  
  const rootChildren: CategoryTreeNode[] = [];
  
  // Sort cats so "Uncategorized" is processed first or handled specially
  const uncategorized = cats.find(c => c.name === DEFAULT_CATEGORY_NAME && !c.parent_id);
  
  cats.filter(c => !c.is_hybrid).forEach(c => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      const parent = map.get(c.parent_id);
      if (parent && !parent.parent_id) parent.children.push(node);
    } else if (c.id !== uncategorized?.id) {
      rootChildren.push(node);
    }
  });

  // Create virtual root
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

  if (uncategorized && map.has(uncategorized.id)) {
    virtualRoot.children.push(map.get(uncategorized.id)!);
  }
  
  virtualRoot.children.push(...rootChildren);
  
  return virtualRoot;
}

export default function Categories() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CategoryTreeNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set([VIRTUAL_ROOT_ID]));

  const fetchCategories = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const data = await categoryService.listCategories();
      setCategories(data);
      if (isInitial) {
        setExpandedIds(new Set([VIRTUAL_ROOT_ID, ...data.filter(c => !c.parent_id && !c.is_hybrid).map(c => c.id)]));
      }
    } catch (error) { toast.error("فشل جلب التصنيفات: " + error); }
    finally { if (isInitial) setLoading(false); }
  }, []);

  useEffect(() => { void fetchCategories(true); }, [fetchCategories]);

  const tree = useMemo(() => buildTree(categories), [categories]);
  
  const filteredTree = useMemo(() => {
    if (!search) return tree;
    // For search, we still want to show the virtual root but filter its children
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
      await fetchCategories(true);
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
          <p>جاري تحميل التصنيفات...</p>
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
      <div className="flex-1">اسم التصنيف</div>
      <div className="w-[80px]">المواد</div>
      <div className="w-[80px]">الحالة</div>
    </>
  );

  return (
    <>
      <PageHeader
        title="تصنيفات المواد"
        subtitle="إدارة شجرة التصنيفات الهرمية وتصنيفات المواد"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "بطاقات المواد", to: "/materials" }, { label: "التصنيفات" }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Folders className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">{categories.filter(c => !c.is_hybrid).length}</div>
            <div className="text-xs text-muted-foreground">إجمالي التصنيفات</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <Folders className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-blue-600">
              {categories.reduce((s, c) => s + (c.material_count ?? 0), 0)}
            </div>
            <div className="text-xs text-muted-foreground">إجمالي المواد المصنفة</div>
          </div>
        </Card>
      </div>

      <TreeLayout
        searchQuery={search}
        onSearchChange={setSearch}
        onExpandAll={() => setExpandedIds(new Set([VIRTUAL_ROOT_ID, ...categories.map(c => c.id)]))}
        onCollapseAll={() => setExpandedIds(new Set([VIRTUAL_ROOT_ID]))}
        onRefresh={() => void fetchCategories(true)}
        loading={loading}
        tableHeader={tableHeader}
        treeContent={treeContent}
        sidebarContent={
          <CategoryDetailsSidebar
            selected={selected?.id === VIRTUAL_ROOT_ID ? null : selected}
            allCategories={categories}
            parentName={parentName}
            onSaved={() => void fetchCategories(false)}
            onDelete={handleDelete}
            isVirtualRootSelected={selected?.id === VIRTUAL_ROOT_ID}
          />
        }
      />
    </>
  );
}
