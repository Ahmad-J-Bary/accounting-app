import { useNavSidebarSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { NAV_GROUPS } from './sidebarConfig';
import { SidebarLogo } from './components/SidebarLogo';
import { SidebarNavSection } from './components/SidebarNavSection';
import { SidebarCollapseBtn } from './components/SidebarCollapseBtn';
import { SidebarFooter } from './components/SidebarFooter';
import { SidebarTopNav } from './components/SidebarTopNav';

interface SidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export function Sidebar({ collapsed: _collapsed, onClose }: SidebarProps) {
  const { settings, updateSetting, getNavWidth } = useNavSidebarSettings();

  const {
    navLayoutType,
    navCollapsed,
    navIconOnly,
    navShowSectionHeaders,
    navActiveBg,
    navHoverBg,
    navDensity,
    navShowLabels,
    navBordered,
    navBackground,
  } = settings;

  // Handle layout type: topnav-slim renders as horizontal bar
  if (navLayoutType === 'topnav-slim') {
    return (
      <SidebarTopNav
        groups={NAV_GROUPS}
        activeBg={navActiveBg}
        hoverBg={navHoverBg}
      />
    );
  }

  const isCollapsed = navCollapsed;
  const isIconOnly = navCollapsed && navIconOnly;
  const densityPadding = navDensity === 'compact' ? 'py-3' : navDensity === 'spacious' ? 'py-6' : 'py-4';
  const sectionSpacing = navDensity === 'compact' ? 'space-y-4' : navDensity === 'spacious' ? 'space-y-8' : 'space-y-6';
  const actualWidth = getNavWidth();

  const isBgLight = navBackground === 'bg-white' || navBackground === 'bg-slate-50';
  const textClass = isBgLight ? 'text-slate-800' : 'text-white';
  const borderClass = isBgLight ? 'border-slate-200' : 'border-slate-800/50';

  const handleToggleCollapse = () => {
    updateSetting('navCollapsed', !navCollapsed);
  };

  return (
    <aside
      className={cn(
        "h-screen flex flex-col transition-all duration-300 ease-in-out",
        navBackground,
        textClass,
        navBordered ? `border-l ${borderClass}` : "border-none"
      )}
      style={{ width: actualWidth, minWidth: actualWidth }}
    >
      {/* Logo + Title + Close button */}
      <SidebarLogo
        collapsed={isCollapsed}
        iconOnly={isIconOnly}
        onClose={onClose}
      />

      {/* Navigation items */}
      <nav className={cn(
        "flex-1 overflow-y-auto scrollbar-hide",
        densityPadding,
        "px-3",
        sectionSpacing,
      )}>
        {NAV_GROUPS.map((group) => (
          <SidebarNavSection
            key={group.title}
            group={group}
            collapsed={isCollapsed}
            iconOnly={isIconOnly}
            showSectionHeaders={navShowSectionHeaders}
            activeBg={navActiveBg}
            hoverBg={navHoverBg}
            onClose={onClose}
          />
        ))}
      </nav>

      {/* Collapse toggle button */}
      <SidebarCollapseBtn
        collapsed={isCollapsed}
        onToggle={handleToggleCollapse}
      />

      {/* Version footer */}
      <SidebarFooter
        collapsed={isCollapsed}
        iconOnly={isIconOnly}
      />
    </aside>
  );
}
