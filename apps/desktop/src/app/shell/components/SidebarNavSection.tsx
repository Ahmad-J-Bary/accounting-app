import { SidebarNavItem } from './SidebarNavItem';
import type { NavGroup } from '../sidebarConfig';

interface SidebarNavSectionProps {
  group: NavGroup;
  collapsed: boolean;
  iconOnly: boolean;
  showSectionHeaders: boolean;
  activeBg: string;
  hoverBg: string;
  onClose?: () => void;
}

export function SidebarNavSection({ group, collapsed, iconOnly, showSectionHeaders, activeBg, hoverBg, onClose }: SidebarNavSectionProps) {
  const showHeader = showSectionHeaders && !collapsed && !iconOnly;

  return (
    <div>
      {showHeader && (
        <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">
          {group.title}
        </div>
      )}
      <ul className="space-y-1">
        {group.items.map((item) => (
          <SidebarNavItem
            key={item.to}
            item={item}
            collapsed={collapsed}
            iconOnly={iconOnly}
            activeBg={activeBg}
            hoverBg={hoverBg}
            onClose={onClose}
          />
        ))}
      </ul>
    </div>
  );
}
