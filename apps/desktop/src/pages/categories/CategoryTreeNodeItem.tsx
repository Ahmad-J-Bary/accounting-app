import { FolderOpen, Folder, Folders, Lock, Package, Type, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TreeItem } from "../../components/erp/tree-management/TreeItem";
import type { CategoryDto } from "@erp/shared-types";

interface CategoryTreeNode extends CategoryDto {
  children: CategoryTreeNode[];
  isMaterial?: boolean; // Flag injected by buildTree
}

interface CategoryTreeNodeItemProps {
  node: CategoryTreeNode;
  level?: number;
  selectedId: string;
  onSelect: (node: CategoryTreeNode) => void;
  expandedNodes: Set<string>;
  onToggle: (id: string, event: React.MouseEvent) => void;
}

const VIRTUAL_ROOT_ID = "__categories_root__";

export function CategoryTreeNodeItem({
  node,
  level = 0,
  selectedId,
  onSelect,
  expandedNodes,
  onToggle,
}: CategoryTreeNodeItemProps) {
  const isVirtualRoot = node.id === VIRTUAL_ROOT_ID;
  const isDefault = node.name === "غير مصنف" && !node.parent_id;
  const isRoot = !node.parent_id && !isVirtualRoot;
  const isMaterial = node.isMaterial;

  const renderIcon = (n: any, expanded: boolean) => {
    if (n.isMaterial) {
      return <Package className="w-3.5 h-3.5 text-emerald-500/70" />;
    }

    if (isVirtualRoot) return <Folders className="w-4 h-4 text-primary" />;
    if (isDefault) return <Lock className="w-4 h-4 text-blue-400" />;
    if (n.is_hybrid) return <Shuffle className="w-4 h-4 text-purple-400" />;
    if (isRoot) return expanded ? <FolderOpen className="w-4 h-4 text-amber-500" /> : <Folder className="w-4 h-4 text-amber-500" />;
    return <Folder className="w-4 h-4 text-slate-300" />;
  };

  const renderLabel = (n: any) => {
    if (n.isMaterial) {
      return (
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs text-slate-500 truncate font-medium">{n.name}</span>
          <span className="text-[10px] font-mono bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100/50">
            {n.code_prefix} {/* code was passed as code_prefix in buildTree */}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 overflow-hidden">
        <span className={cn(
          "text-sm font-medium truncate",
          isVirtualRoot && "text-primary font-bold",
          isDefault && "text-blue-700",
          !isRoot && !isVirtualRoot && "text-slate-600",
          isRoot && !isDefault && "text-slate-800"
        )}>
          {n.name}
        </span>
        {n.code_prefix && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-blue-200 bg-blue-50 text-blue-600 font-mono gap-1">
            <Type className="w-3 h-3" />
            {n.code_prefix}
          </Badge>
        )}
      </div>
    );
  };

  const renderRight = (n: any) => {
    if (isVirtualRoot || n.isMaterial) return null;
    
    return (
      <>
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 tabular-nums bg-white/60 gap-1">
          <Package className="w-3 h-3 opacity-40" />
          {n.material_count || 0}
        </Badge>
        <div className="w-[80px]">
          {n.is_active ? (
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">نشط</span>
          ) : (
            <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">معطل</span>
          )}
        </div>
      </>
    );
  };

  return (
    <TreeItem
      node={node}
      level={level}
      selectedId={selectedId}
      onSelect={(n: any) => {
        if (!n.isMaterial) onSelect(n);
      }}
      expandedNodes={expandedNodes}
      onToggle={onToggle}
      renderIcon={renderIcon}
      renderLabel={renderLabel}
      renderRight={renderRight}
      virtualRootId={VIRTUAL_ROOT_ID}
    />
  );
}
