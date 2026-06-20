import { Link, useLocation } from "react-router-dom";
import { useTabs } from '@app/providers/TabContext';
import { cn } from '@shared/lib/utils';
import { useNavSidebarSettings } from '@shared/hooks';
import type { NavItem } from '../sidebarConfig';

interface SidebarNavItemProps {
  item: NavItem;
  collapsed: boolean;
  iconOnly: boolean;
  activeBg: string;
  hoverBg: string;
  onClose?: () => void;
}

export function SidebarNavItem({ item, collapsed, iconOnly, activeBg, hoverBg, onClose }: SidebarNavItemProps) {
  const { openTab, updateMainTab, activeTabId } = useTabs();
  const location = useLocation();
  const { settings, getNavFontSizeClass } = useNavSidebarSettings();

  const isActive = activeTabId === item.to || location.pathname === item.to;
  const isBgLight = settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  
  const fontSizeClass = getNavFontSizeClass();
  const inactiveTextClass = isBgLight ? 'text-slate-600' : 'text-slate-400';
  const iconColorClass = isActive ? "text-white" : (isBgLight ? "text-slate-500 group-hover:text-slate-800" : "text-slate-500 group-hover:text-slate-300");

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      openTab({
        id: `${item.to}-${Date.now()}`,
        title: item.label,
        path: item.to,
        closable: true,
      });
    } else {
      updateMainTab({ title: item.label, path: item.to });
    }
    if (onClose && window.innerWidth < 1024) onClose();
  };

  return (
    <li>
      <Link
        to={item.to}
        onClick={handleClick}
        className={cn(
          "group flex items-center gap-3 rounded-lg transition-all duration-200",
          collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
          fontSizeClass,
          isActive
            ? `${activeBg} text-white shadow-md font-medium`
            : `${inactiveTextClass} ${hoverBg}`
        )}
        title={collapsed || iconOnly ? item.label : undefined}
      >
        <item.icon className={cn(
          "w-4 h-4 shrink-0 transition-colors",
          iconColorClass
        )} />
        {!collapsed && !iconOnly && (
          <>
            <span className="truncate">{item.label}</span>
            {isActive && (
              <div className="mr-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
          </>
        )}
      </Link>
    </li>
  );
}
