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
  siblingFlags = [],
}: TreeItemProps<T>) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div className="relative group">
        {level > 0 && (
          <div
            className="absolute right-0 top-0 bottom-0 pointer-events-none z-10"
            style={{ width: `${level * 16}px` }}
          >
            <div className="relative w-full h-full">
              {Array.from({ length: level }).map((_, i) => {
                const isCurrentLevel = i === level - 1;
                const hasMoreSiblings = siblingFlags[i] ?? false;

                return (
                  <div
                    key={i}
                    className="absolute inset-y-0 flex items-center justify-center"
                    style={{ right: `${i * 16}px`, width: '16px' }}
                  >
                    {/* Ancestor levels — vertical continuation line */}
                    {!isCurrentLevel && hasMoreSiblings && (
                      <div className="w-px h-full bg-slate-400/60 rounded-full" />
                    )}
                    {/* Current node level — connector piece */}
                    {isCurrentLevel && (
                      <>
                        {/* Vertical line up to parent */}
                        <div className="absolute top-0 right-1/2 w-px bg-slate-400/70 rounded-full" style={{ height: 'calc(50% - 3px)' }} />
                        {/* Vertical line down to next sibling */}
                        {hasMoreSiblings && (
                          <div className="absolute bottom-0 right-1/2 w-px bg-slate-400/70 rounded-full" style={{ height: 'calc(50% - 3px)' }} />
                        )}
                        {/* Horizontal branch toward content */}
                        <div className="absolute top-1/2 right-1/2 -translate-y-1/2 w-1/2 h-px bg-slate-400/70 rounded-full" />
                        {/* Junction dot */}
                        <div className="absolute top-1/2 right-1/2 -translate-y-1/2 translate-x-1/2 w-[5px] h-[5px] rounded-full bg-slate-400/80 shadow-sm" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex items-center gap-2 py-2.5 px-3 cursor-pointer transition-all duration-150",
            "border-b border-slate-100 hover:bg-slate-50/80",
            isSelected && "bg-primary/5 border-l-2 border-l-primary hover:bg-primary/10",
          )}
          style={{ paddingRight: `${level * 16 + 12}px` }}
          onClick={() => onSelect(node)}
        >
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

          <div className="flex items-center justify-center w-5">
            {renderIcon(node, isExpanded)}
          </div>

          <div className="flex-1 truncate">
            {renderLabel(node)}
          </div>

          {renderRight && (
            <div className="flex items-center gap-4">
              {renderRight(node)}
            </div>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="bg-white/50">
          {node.children.map((child: T, idx, arr) => (
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
              siblingFlags={[...siblingFlags, idx < arr.length - 1]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
