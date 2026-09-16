import { FolderOpen, Folder, Folders, Lock, Package, Type, Shuffle } from "lucide-react";
import { cn } from '@shared/lib/utils';
import { Badge } from "@shared/ui/badge";
import { TreeItem } from '@widgets/tree-sidebar/TreeItem';
import type { CategoryDto } from "@erp/shared-types";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  const { t } = useLocalization();
  const isVirtualRoot = node.id === VIRTUAL_ROOT_ID;
  const uncategorizedName = t("materials.uncategorized", { namespace: "inventory" });
  const isDefault = node.name === uncategorizedName && !node.parent_id;
  const isRoot = !node.parent_id && !isVirtualRoot;

  const renderIcon = (n: CategoryTreeNode, expanded: boolean) => {
    if (n.isMaterial) {
      return <Package className="w-3.5 h-3.5 text-success" />;
    }

    if (isVirtualRoot) return <Folders className="w-4 h-4 text-primary" />;
    if (isDefault) return <Lock className="w-4 h-4 text-primary" />;
    if (n.is_hybrid) return <Shuffle className="w-4 h-4 text-purple-400" />;
    if (isRoot) return expanded ? <FolderOpen className="w-4 h-4 text-amber-500" /> : <Folder className="w-4 h-4 text-amber-500" />;
    return <Folder className="w-4 h-4 text-muted-foreground" />;
  };

  const renderLabel = (n: CategoryTreeNode) => {
    if (n.isMaterial) {
      return (
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs text-muted-foreground truncate font-medium">{n.name}</span>
          <span className="text-[10px] font-mono bg-success/10 text-success px-1.5 py-0.5 rounded border border-primary/10">
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
          isDefault && "text-primary",
          !isRoot && !isVirtualRoot && "text-foreground",
          isRoot && !isDefault && "text-foreground"
        )}>
          {n.name}
        </span>
        {n.code_prefix && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/20 bg-primary/10 text-primary font-mono gap-1">
            <Type className="w-3 h-3" />
            {n.code_prefix}
          </Badge>
        )}
      </div>
    );
  };

  const renderRight = (n: CategoryTreeNode) => {
    if (isVirtualRoot || n.isMaterial) return null;
    
    return (
      <>
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 tabular-nums bg-white/60 gap-1">
          <Package className="w-3 h-3 opacity-40" />
          {n.material_count || 0}
        </Badge>
        <div className="w-[80px]">
          {n.is_active ? (
            <span className="text-[10px] text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/10">{t("labels.active", { namespace: "inventory",  })}</span>
          ) : (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-muted">{t("states.disabled", { namespace: "common",  })}</span>
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
      onSelect={(n: CategoryTreeNode) => {
        onSelect(n);
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
