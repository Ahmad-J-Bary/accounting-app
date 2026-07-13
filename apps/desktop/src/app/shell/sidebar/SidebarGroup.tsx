import { useNavSidebarSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { ICON_MAP } from '@app/shell/sidebarConfig';
import type { SidebarGroupConfig } from '@shared/types/sidebar-config';
import { SidebarItem } from './SidebarItem';
import { ChevronDown, ChevronUp, FolderPlus } from 'lucide-react';

interface SidebarGroupProps {
  group: SidebarGroupConfig;
  collapsed: boolean;
  iconOnly: boolean;
  activeBg: string;
  hoverBg: string;
  isGroupCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
  verticalAppearance?: 'light' | 'dark';
}

export function SidebarGroup({
  group,
  collapsed,
  iconOnly,
  activeBg,
  hoverBg,
  isGroupCollapsed,
  onToggleCollapse,
  onClose,
  verticalAppearance,
}: SidebarGroupProps) {
  const { settings } = useNavSidebarSettings();

  const {
    navGroupCollapseBehavior = 'free',
    navGroupHeaderStyle = 'classic',
  } = settings;

  const isBgLight = verticalAppearance
    ? verticalAppearance === 'light'
    : settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  const sectionHeaderClass = isBgLight ? 'text-slate-400' : 'text-slate-500';
  const borderClass = isBgLight ? 'border-slate-200' : 'border-white/5';

  const GroupIcon = ICON_MAP[group.icon || ''] ?? FolderPlus;
  const displayTitle = group.customTitle ?? group.defaultTitle;
  const visibleItems = group.items.filter(i => i.visible);

  const showHeader = settings.navShowSectionHeaders && !collapsed && !iconOnly;

  // تحديد ما إذا كان المجلد مطوياً
  const isCollapsed =
    navGroupCollapseBehavior === 'all-expanded'
      ? false
      : isGroupCollapsed !== undefined
      ? isGroupCollapsed
      : group.collapsed;

  if (!group.visible) return null;

  // تفعيل التبديل بالضغط على العنوان بالكامل في وضع الأكورديون أو التخصيص الحر
  const handleHeaderClick = () => {
    if (navGroupCollapseBehavior !== 'all-expanded' && onToggleCollapse) {
      onToggleCollapse();
    }
  };

  // أيقونة المجموعة مع لون الخلفية حسب الوضع
  const iconBgClass = isBgLight ? 'bg-slate-200/60 text-slate-500' : 'bg-white/10 text-slate-400';

  // نمط ترويسة المجموعة
  const renderHeaderTitle = () => {
    if (navGroupHeaderStyle === 'line') {
      return (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn("w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors", iconBgClass)}>
            <GroupIcon className="w-2.5 h-2.5" />
          </span>
          <span className={cn("text-[10px] font-bold uppercase tracking-[0.1em] shrink-0", sectionHeaderClass)}>
            {displayTitle}
          </span>
          <div className={cn("flex-1 h-px border-t opacity-10", borderClass)} />
        </div>
      );
    }

    if (navGroupHeaderStyle === 'card') {
      return (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn(
            "w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-colors",
            isCollapsed ? iconBgClass : isBgLight ? "bg-blue-100 text-blue-600" : "bg-blue-500/20 text-blue-400"
          )}>
            <GroupIcon className="w-3 h-3" />
          </span>
          <span className={cn(
            "text-[10px] font-black truncate",
            isCollapsed
              ? isBgLight ? "text-slate-600" : "text-slate-400"
              : isBgLight ? "text-slate-800" : "text-white"
          )}>
            {displayTitle}
          </span>
        </div>
      );
    }

    // classic
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={cn(
          "w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors group-hover/group:scale-110",
          iconBgClass,
          isBgLight
            ? "group-hover/group:bg-slate-200/80 group-hover/group:text-slate-700"
            : "group-hover/group:bg-white/15 group-hover/group:text-white"
        )}>
          <GroupIcon className="w-2.5 h-2.5" />
        </span>
        <span className={cn("text-[10px] font-bold uppercase tracking-[0.1em] truncate flex-1", sectionHeaderClass)}>
          {displayTitle}
        </span>
      </div>
    );
  };

  const isCardStyle = navGroupHeaderStyle === 'card';
  const showCollapseBtn = navGroupCollapseBehavior !== 'all-expanded';

  return (
    <div className={cn("group/group", isCardStyle && "mb-1 px-1")}>
      {/* ── عنوان المجموعة ── */}
      {showHeader && (
        <div
          onClick={handleHeaderClick}
          className={cn(
            "transition-all duration-200 select-none",
            isCardStyle
              ? cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black cursor-pointer border",
                  isCollapsed
                    ? isBgLight
                      ? "text-slate-600 hover:bg-slate-100 hover:border-slate-300 border-slate-200/40"
                      : "text-slate-400 hover:bg-white/8 hover:border-white/15 border-white/5"
                    : isBgLight
                    ? "bg-gradient-to-r from-slate-100 to-slate-50 text-slate-800 border-slate-200/80 shadow-sm hover:shadow-md"
                    : "bg-gradient-to-r from-white/[0.07] to-white/[0.03] text-white border-white/10 shadow-sm hover:shadow-md"
                )
              : "flex items-center justify-between px-3 mb-1.5 mt-1 cursor-pointer rounded-lg hover:bg-white/[0.02] -mx-1 transition-colors"
          )}
        >
          {renderHeaderTitle()}

          {showCollapseBtn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleHeaderClick();
              }}
              className={cn(
                "p-0.5 rounded transition-all duration-200",
                isCardStyle ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover/group:opacity-100",
                sectionHeaderClass,
                isBgLight ? "hover:bg-slate-200 hover:text-slate-700" : "hover:bg-white/10 hover:text-white"
              )}
              title={isCollapsed ? "توسيع" : "طي"}
            >
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      )}

      {/* ── عناصر المجموعة مع تأثير الحركة الأنيق ── */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isCollapsed ? "grid-rows-[0fr] opacity-0 pointer-events-none" : "grid-rows-[1fr] opacity-100"
        )}
      >
        <div className="overflow-hidden">
          <ul className={cn("space-y-0.5", showHeader && !isCardStyle && "mt-1", isCardStyle && "py-1 px-1 bg-slate-50/20 dark:bg-white/[0.01] rounded-xl mt-1 border border-slate-100 dark:border-white/[0.02]")}>
            {visibleItems.map(item => (
              <SidebarItem
                key={item.id}
                item={item}
                collapsed={collapsed}
                iconOnly={iconOnly}
                activeBg={activeBg}
                hoverBg={hoverBg}
                onClose={onClose}
                verticalAppearance={verticalAppearance}
              />
            ))}
          </ul>
        </div>
      </div>

      {/* فاصل بين المجموعات (فقط للأنماط غير البطاقة) */}
      {showHeader && !isCardStyle && (
        <div className={cn("mt-3 mb-1 border-t opacity-30", borderClass)} />
      )}
    </div>
  );
}
