import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from '@shared/lib/utils';
import { TreeItemProps, BaseTreeNode } from "./types";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function TreeItem<T extends BaseTreeNode>({
  node,
  level = 0,
  selectedId,
  onSelect,
  onDoubleClick,
  expandedNodes,
  onToggle,
  renderIcon,
  renderLabel,
  renderRight,
  isVirtualRoot,
  virtualRootId,
  siblingFlags = [],
}: TreeItemProps<T>) {
  const { direction } = useLocalization();
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  const CollapsedIcon = direction === "rtl" ? ChevronLeft : ChevronRight;
  const inlineStart = direction === "rtl" ? "right" : "left";
  const inlineEnd = direction === "rtl" ? "left" : "right";

  return (
    <div>
      <div className="relative group">
        {level > 0 && (
          <div
            className="pointer-events-none absolute inset-y-0 z-10"
            style={{ [inlineStart]: 0, width: `${level * 16}px` }}
          >
            <div className="relative w-full h-full">
              {Array.from({ length: level }).map((_, i) => {
                const isCurrentLevel = i === level - 1;
                const hasMoreSiblings = siblingFlags[i] ?? false;

                return (
                  <div
                    key={i}
                    className="absolute inset-y-0 flex items-center justify-center"
                    style={{ [inlineStart]: `${i * 16}px`, width: '16px' }}
                  >
                    {/* Ancestor levels — vertical continuation line */}
                    {!isCurrentLevel && hasMoreSiblings && (
                      <div className="w-px h-full bg-slate-400/60 rounded-full" />
                    )}
                    {/* Current node level — connector piece */}
                    {isCurrentLevel && (
                      <>
                        {/* Vertical line up to parent */}
                        <div className="absolute top-0 w-px rounded-full bg-slate-400/70" style={{ [inlineStart]: '50%', height: 'calc(50% - 3px)' }} />
                        {/* Vertical line down to next sibling */}
                        {hasMoreSiblings && (
                          <div className="absolute bottom-0 w-px rounded-full bg-slate-400/70" style={{ [inlineStart]: '50%', height: 'calc(50% - 3px)' }} />
                        )}
                        {/* Horizontal branch toward content */}
                        <div className="absolute top-1/2 h-px w-1/2 -translate-y-1/2 rounded-full bg-slate-400/70" style={{ [inlineStart]: '50%' }} />
                        {/* Junction dot */}
                        <div
                          className="absolute top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full bg-slate-400/80 shadow-sm"
                          style={{
                            [inlineStart]: '50%',
                            transform: `translateY(-50%) ${direction === 'rtl' ? 'translateX(50%)' : 'translateX(-50%)'}`,
                          }}
                        />
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
              isSelected && "border-s-2 border-s-primary bg-primary/5 hover:bg-primary/10",
          )}
          style={{ paddingInlineStart: `${level * 16 + 12}px` }}
          onClick={() => onSelect(node)}
          onDoubleClick={() => onDoubleClick?.(node)}
        >
          <div className="flex items-center justify-center w-6">
            {hasChildren ? (
              <button
                onClick={(event) => onToggle(node.id, event)}
                onDoubleClick={(event) => event.stopPropagation()}
                className={cn(
                  "p-1 rounded-md transition-colors",
                  "hover:bg-muted/70 text-muted-foreground hover:text-foreground",
                  "focus:outline-none focus:ring-1 focus:ring-primary/30"
                )}
                type="button"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <CollapsedIcon className="w-4 h-4" />
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
          {node.children.map((child, idx, arr) => (
            <TreeItem
              key={child.id}
              node={child as T}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
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
