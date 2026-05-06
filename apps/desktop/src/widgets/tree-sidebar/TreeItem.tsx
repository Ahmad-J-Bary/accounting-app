import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from '@shared/lib/utils';
import { TreeItemProps, BaseTreeNode } from "./types";

export function TreeItem<T extends BaseTreeNode>({
  node,
  level = 0,
  selectedId,
  onSelect,
  expandedNodes,
  onToggle,
  renderIcon,
  renderLabel,
  renderRight,
  isVirtualRoot,
  virtualRootId,
}: TreeItemProps<T>) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-center gap-2 py-2.5 px-3 cursor-pointer transition-all duration-150",
          "border-b border-slate-100 hover:bg-slate-50/80",
          isSelected && "bg-primary/5 border-l-2 border-l-primary hover:bg-primary/10",
        )}
        style={{ paddingRight: `${level * 16 + 12}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/Collapse Button */}
        <div className="flex items-center justify-center w-6">
          {hasChildren ? (
            <button
              onClick={(event) => onToggle(node.id, event)}
              className={cn(
                "p-1 rounded-md transition-colors",
                "hover:bg-slate-200/70 text-slate-500 hover:text-slate-700",
                "focus:outline-none focus:ring-1 focus:ring-primary/30"
              )}
              type="button"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
        </div>

        {/* Icon */}
        <div className="flex items-center justify-center w-5">
          {renderIcon(node, isExpanded)}
        </div>

        {/* Label (Name/Code etc) */}
        <div className="flex-1 truncate">
          {renderLabel(node)}
        </div>

        {/* Right Content (Badges/Status/Balance etc) */}
        {renderRight && (
          <div className="flex items-center gap-4">
            {renderRight(node)}
          </div>
        )}
      </div>

      {/* Render Children */}
      {hasChildren && isExpanded && (
        <div className="bg-white/50">
          {node.children.map((child: T) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              renderIcon={renderIcon}
              renderLabel={renderLabel}
              renderRight={renderRight}
              isVirtualRoot={isVirtualRoot}
              virtualRootId={virtualRootId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
