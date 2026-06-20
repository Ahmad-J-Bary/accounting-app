import { useLocation } from "react-router-dom";
import { useTabs } from '@app/providers/TabContext';
import { cn } from '@shared/lib/utils';
import { useNavSidebarSettings } from '@shared/hooks';
import type { NavGroup } from '../sidebarConfig';

interface SidebarTopNavProps {
  groups: NavGroup[];
  activeBg: string;
  hoverBg: string;
}

export function SidebarTopNav({ groups, activeBg, hoverBg }: SidebarTopNavProps) {
  const { openTab, updateMainTab, activeTabId } = useTabs();
  const location = useLocation();
  const { settings, getNavFontSizeClass } = useNavSidebarSettings();

  const isBgLight = settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  const borderClass = isBgLight ? 'border-b border-slate-200' : 'border-b border-slate-800';
  const inactiveTextClass = isBgLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400';
  const fontSizeClass = getNavFontSizeClass();

  return (
    <nav className={cn(
      "h-14 flex items-center px-4 gap-1 overflow-x-auto shrink-0",
      settings.navBackground,
      borderClass
    )}>
      {groups.map((group) => (
        <div key={group.title} className="flex items-center gap-1">
          {group.items.map((item) => {
            const isActive = activeTabId === item.to || location.pathname === item.to;
            return (
              <button
                key={item.to}
                onClick={(e) => {
                  e.preventDefault();
                  if (e.ctrlKey) {
                    openTab({ id: `${item.to}-${Date.now()}`, title: item.label, path: item.to, closable: true });
                  } else {
                    updateMainTab({ title: item.label, path: item.to });
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200",
                  fontSizeClass,
                  isActive
                    ? `${activeBg} text-white shadow-md font-medium`
                    : `${inactiveTextClass} ${hoverBg}`
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
