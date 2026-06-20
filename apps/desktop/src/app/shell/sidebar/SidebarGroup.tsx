import React from 'react';
import { useSidebarLayout } from '@shared/hooks';
import { useNavSidebarSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import type { SidebarGroupConfig } from '@shared/types/sidebar-config';
import { SidebarItem } from './SidebarItem';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SidebarGroupProps {
  group: SidebarGroupConfig;
  collapsed: boolean;
  iconOnly: boolean;
  activeBg: string;
  hoverBg: string;
  onClose?: () => void;
}

export function SidebarGroup({
  group, collapsed, iconOnly, activeBg, hoverBg, onClose,
}: SidebarGroupProps) {
  const { toggleGroupCollapsed } = useSidebarLayout();
  const { settings } = useNavSidebarSettings();

  const isBgLight = settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  const sectionHeaderClass = isBgLight ? 'text-slate-400' : 'text-slate-500';
  const borderClass = isBgLight ? 'border-slate-200' : 'border-white/5';

  const displayTitle = group.customTitle ?? group.defaultTitle;
  const visibleItems = group.items.filter(i => i.visible);

  const showHeader = settings.navShowSectionHeaders && !collapsed && !iconOnly;

  if (!group.visible) return null;

  return (
    <div className="group/group">
      {/* ── عنوان المجموعة ── */}
      {showHeader && (
        <div className="flex items-center justify-between px-3 mb-1.5 mt-1">
          <span className={cn("text-[10px] font-bold uppercase tracking-[0.1em] truncate flex-1", sectionHeaderClass)}>
            {displayTitle}
          </span>

          <button
            onClick={() => toggleGroupCollapsed(group.id)}
            className={cn("p-0.5 rounded opacity-0 group-hover/group:opacity-100 transition-opacity", sectionHeaderClass, "hover:text-white")}
            title={group.collapsed ? "توسيع" : "طي"}
          >
            {group.collapsed ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />}
          </button>
        </div>
      )}

      {/* ── عناصر المجموعة ── */}
      {!group.collapsed && (
        <ul className="space-y-0.5">
          {visibleItems.map(item => (
            <SidebarItem
              key={item.id}
              item={item}
              collapsed={collapsed}
              iconOnly={iconOnly}
              activeBg={activeBg}
              hoverBg={hoverBg}
              onClose={onClose}
            />
          ))}
        </ul>
      )}

      {/* فاصل بين المجموعات */}
      {showHeader && <div className={cn("mt-3 mb-1 border-t opacity-30", borderClass)} />}
    </div>
  );
}
