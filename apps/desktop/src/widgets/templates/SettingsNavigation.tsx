import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useIsLaptop, useIsTablet } from "@shared/hooks/useResponsive";

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface SettingsNavigationProps {
  /** Main navigation items */
  items: SettingsNavItem[];
  /** Collapsible group items (e.g., Appearance sub-items) */
  groupItems?: SettingsNavItem[];
  /** Group label */
  groupLabel?: string;
  /** Currently active nav item id */
  activeNav: string;
  /** Callback when nav item is clicked */
  onNavChange: (id: string) => void;
  /** Whether the group is expanded */
  groupExpanded?: boolean;
  /** Callback to toggle group expansion */
  onGroupToggle?: () => void;
  /** Additional class names */
  className?: string;
  /** Render mode - controls layout behavior */
  mode?: "sidebar" | "compact" | "drawer";
  /** Optional footer content */
  footer?: ReactNode;
}

export function SettingsNavigation({
  items,
  groupItems,
  groupLabel,
  activeNav,
  onNavChange,
  groupExpanded = false,
  onGroupToggle,
  className,
  mode = "sidebar",
  footer,
}: SettingsNavigationProps) {
  const isLaptop = useIsLaptop();
  const isTablet = useIsTablet();

  const resolvedMode = mode === "sidebar"
    ? (isLaptop ? "compact" : isTablet ? "drawer" : "sidebar")
    : mode;

  const isCompact = resolvedMode === "compact";

  const renderItem = (item: SettingsNavItem, isSubItem = false) => {
    const isActive = activeNav === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => onNavChange(item.id)}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl font-bold transition-all",
          isCompact ? "justify-center px-2 py-2.5" : "px-3 sm:px-4 py-2.5 sm:py-3",
          isSubItem && !isCompact && "me-4 sm:me-6",
          isSubItem && "py-2 sm:py-2.5 rounded-lg font-medium",
          isSubItem ? "text-xs sm:text-sm" : "text-sm sm:text-base",
          isActive
            ? "bg-primary text-primary-foreground shadow-md"
            : "text-muted-foreground hover:bg-accent"
        )}
        title={isCompact ? item.label : undefined}
        aria-label={isCompact ? item.label : undefined}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon className={cn("shrink-0", isCompact ? "w-5 h-5" : "w-4 h-4")} />
        {!isCompact && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  const renderGroup = () => {
    if (!groupItems || !groupLabel || !onGroupToggle) return null;
    const GroupIcon = groupItems[0].icon;

    return (
      <div className="space-y-1">
        <button
          onClick={onGroupToggle}
          className={cn(
            "w-full flex items-center justify-between gap-3 rounded-xl font-bold transition-all text-muted-foreground hover:bg-accent",
            isCompact ? "justify-center px-2 py-2.5" : "px-3 sm:px-4 py-2.5 sm:py-3",
            isCompact ? "text-sm" : "text-sm sm:text-base"
          )}
          title={isCompact ? groupLabel : undefined}
          aria-label={isCompact ? groupLabel : undefined}
          aria-expanded={groupExpanded}
        >
          <div className={cn("flex items-center gap-3", isCompact && "justify-center")}>
            <GroupIcon className={cn("shrink-0", isCompact ? "w-5 h-5" : "w-4 h-4")} />
            {!isCompact && <span>{groupLabel}</span>}
          </div>
          {!isCompact && (
            groupExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />
          )}
        </button>

        {groupExpanded && !isCompact && (
          <div className="space-y-0.5">
            {groupItems.map(item => renderItem(item, true))}
          </div>
        )}

        {groupExpanded && isCompact && (
          <div className="space-y-0.5">
            {groupItems.map(item => renderItem(item, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav
      className={cn(
        "space-y-1",
        className
      )}
      role="navigation"
      aria-label="Settings navigation"
    >
      {items.map(item => renderItem(item))}
      {renderGroup()}
      {footer}
    </nav>
  );
}
