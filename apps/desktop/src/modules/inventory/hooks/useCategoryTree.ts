import { useMemo } from "react";
import type { CategoryDto, MaterialDto } from "@erp/shared-types";

export const VIRTUAL_ROOT_ID = "__categories_root__";
const DEFAULT_CATEGORY_NAME = "غير مصنف";

export interface CategoryTreeNode extends CategoryDto {
  children: CategoryTreeNode[];
  isMaterial?: boolean;
  materialData?: MaterialDto;
}

function buildTree(cats: CategoryDto[], materials: MaterialDto[]): CategoryTreeNode {
  const map = new Map<string, CategoryTreeNode>();
  
  // 1. Initialize map with clones
  const normalCats = cats.filter(c => !c.is_hybrid);
  normalCats.forEach(c => map.set(c.id, { ...c, children: [] }));
  
  // 2. Attach materials
  materials.forEach(m => {
    const categoryIds = m.category_ids || [];
    const matNode: CategoryTreeNode = {
      id: `mat-${m.id}`,
      name: m.name,
      code_prefix: m.code, 
      is_hybrid: false,
      is_active: m.is_active,
      material_count: 0,
      parent_id: "",
      children: [],
      isMaterial: true,
      materialData: m,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (categoryIds.length === 0) {
      const uncategorized = normalCats.find(c => c.name === DEFAULT_CATEGORY_NAME && !c.parent_id);
      if (uncategorized) {
        const node = map.get(uncategorized.id);
        if (node) node.children.push({ ...matNode, parent_id: uncategorized.id });
      }
    } else {
      categoryIds.forEach(catId => {
        const node = map.get(catId);
        if (node) node.children.push({ ...matNode, parent_id: catId });
      });
    }
  });

  // 3. Build hierarchy with strict cycle detection
  const rootChildren: CategoryTreeNode[] = [];
  const uncategorizedNode = normalCats.find(c => c.name === DEFAULT_CATEGORY_NAME && !c.parent_id);
  const attachedIds = new Set<string>();

  const isAncestor = (parentId: string, nodeId: string): boolean => {
    let current = map.get(parentId);
    while (current) {
      if (current.id === nodeId) return true;
      if (!current.parent_id) break;
      current = map.get(current.parent_id);
    }
    return false;
  };

  normalCats.forEach(c => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id) && c.parent_id !== c.id) {
      if (!attachedIds.has(c.id) && !isAncestor(c.parent_id, c.id)) {
        map.get(c.parent_id)?.children.push(node);
        attachedIds.add(c.id);
      } else if (!attachedIds.has(c.id)) {
        rootChildren.push(node);
        attachedIds.add(c.id);
      }
    } else if (c.id !== uncategorizedNode?.id && !attachedIds.has(c.id)) {
      rootChildren.push(node);
      attachedIds.add(c.id);
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

export function useCategoryTree(categories: CategoryDto[], materials: MaterialDto[], search: string) {
  const tree = useMemo(() => buildTree(categories, materials), [categories, materials]);
  
  const filteredTree = useMemo(() => {
    if (!search) return tree;
    const filterNode = (node: CategoryTreeNode): CategoryTreeNode | null => {
      const filteredChildren = node.children.map(filterNode).filter(Boolean) as CategoryTreeNode[];
      const matches = node.name.toLowerCase().includes(search.toLowerCase());
      if (matches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };
    return filterNode(tree) || { ...tree, children: [] };
  }, [tree, search]);

  return { tree, filteredTree };
}
