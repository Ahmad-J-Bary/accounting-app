import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTabs } from '@app/providers/TabContext';
import { useNavSidebarSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { ICON_MAP } from '@app/shell/sidebarConfig';
import type { SidebarItemConfig } from '@shared/types/sidebar-config';
import { Pin, Zap } from 'lucide-react';

interface SidebarItemProps {
  item: SidebarItemConfig;
  /** وضع الانهيار (collapsed / icon-only) */
  collapsed: boolean;
  iconOnly: boolean;
  activeBg: string;
  hoverBg: string;
  /** Badge اختياري (مثبّت / اختصار) */
  badge?: 'pinned' | 'shortcut';
  onClose?: () => void;
}

export function SidebarItem({
  item, collapsed, iconOnly, activeBg, hoverBg,
  badge, onClose,
}: SidebarItemProps) {
  const { openTab, updateMainTab, activeTabId } = useTabs();
  const location = useLocation();
  const { settings, getNavFontSizeClass } = useNavSidebarSettings();

  const isActive = activeTabId === item.to || location.pathname === item.to;
  const isBgLight = settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  const fontSizeClass = getNavFontSizeClass();
  const inactiveTextClass = isBgLight ? 'text-slate-600' : 'text-slate-400';
  const iconColorClass = isActive
    ? 'text-white'
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

  const badgeClass = badge === 'pinned'
    ? 'text-amber-400'
    : badge === 'shortcut'
    ? 'text-blue-400'
    : '';

  return (
    <li className="group/item relative">
      <div className="flex items-center gap-1">
        <Link
          to={item.to}
          onClick={handleClick}
          className={cn(
            "group flex-1 flex items-center gap-3 rounded-lg transition-all duration-200",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
            fontSizeClass,
            isActive
              ? `${activeBg} text-white shadow-md font-medium`
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
                  {badge === 'pinned'
                    ? <Pin className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    : <Zap className="w-2.5 h-2.5 fill-blue-400 text-blue-400" />
                  }
                </span>
              )}
              {isActive && !badge && (
                <div className="mr-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </>
          )}
        </Link>
      </div>
    </li>
  );
}
