import React from 'react';
import { useTabs } from '@app/providers/TabContext';
import { useNavSidebarSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { ICON_MAP } from '@app/shell/sidebarConfig';
import type { SidebarItemConfig } from '@shared/types/sidebar-config';
import { Pin } from 'lucide-react';

interface SidebarItemProps {
  item: SidebarItemConfig;
  /** وضع الانهيار (collapsed / icon-only) */
  collapsed: boolean;
  iconOnly: boolean;
  activeBg: string;
  hoverBg: string;
  /** Badge اختياري للمثبت */
  badge?: 'pinned';
  onClose?: () => void;
  /** تجاوز المظهر (فاتح/داكن) من AppearanceProvider */
  verticalAppearance?: 'light' | 'dark';
}

export function SidebarItem({
  item, collapsed, iconOnly, activeBg, hoverBg,
  badge, onClose, verticalAppearance,
}: SidebarItemProps) {
  const { openTab, updateMainTab, activeTabId } = useTabs();
  const { settings, getNavFontSizeClass } = useNavSidebarSettings();

  if (item.isSeparator) {
    return (
      <li className="py-1.5">
        <div className={cn(
          "h-px mx-2",
          verticalAppearance === 'light' ? "bg-slate-200" : "bg-white/10"
        )} />
      </li>
    );
  }

  const isActive = activeTabId === item.to;
  const isBgLight = verticalAppearance
    ? verticalAppearance === 'light'
    : settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  const activeTextClass = verticalAppearance === 'light' ? 'text-primary' : 'text-white';
  const fontSizeClass = getNavFontSizeClass();
  const inactiveTextClass = isBgLight ? 'text-slate-600' : 'text-slate-400';
  const iconColorClass = isActive
    ? activeTextClass
    : isBgLight ? 'text-slate-500 group-hover:text-slate-800' : 'text-slate-500 group-hover:text-slate-300';

  const IconComp = ICON_MAP[item.icon] ?? ICON_MAP['Settings'];
  const displayLabel = item.customLabel ?? item.defaultLabel;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      openTab({ id: `${item.to}-${Date.now()}`, title: displayLabel, path: item.to, closable: true });
    } else {
      updateMainTab({ title: displayLabel, path: item.to });
    }
    if (onClose && window.innerWidth < 1024) onClose();
  };

  const badgeClass = badge === 'pinned' ? 'text-amber-400' : '';

  return (
    <li className="group/item relative">
      <div className="flex items-center gap-1">
        <div
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e as unknown as React.MouseEvent); }}
          className={cn(
            "group flex-1 flex items-center gap-3 rounded-lg transition-all duration-200 cursor-pointer",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
            fontSizeClass,
            isActive
              ? `${activeBg} ${activeTextClass} shadow-sm font-semibold`
              : `${inactiveTextClass} ${hoverBg}`
          )}
          title={collapsed || iconOnly ? displayLabel : undefined}
        >
          <IconComp className={cn("w-4 h-4 shrink-0 transition-colors", iconColorClass)} />
          {!collapsed && !iconOnly && (
            <>
              <span className="truncate flex-1">{displayLabel}</span>
              {badge && (
                <span className={cn("shrink-0", badgeClass)}>
                  <Pin className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                </span>
              )}
              {isActive && (
                <div className="mr-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
