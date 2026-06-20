import React from 'react';
import { useNavSidebarSettings, useSidebarLayout } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { NAV_GROUPS } from './sidebarConfig';
import { SidebarLogo } from './components/SidebarLogo';
import { SidebarCollapseBtn } from './components/SidebarCollapseBtn';
import { SidebarFooter } from './components/SidebarFooter';
import { SidebarTopNav } from './components/SidebarTopNav';
import { SidebarGroup } from './sidebar/SidebarGroup';
import { SidebarPinnedSection } from './sidebar/SidebarPinnedSection';
import { SidebarShortcutsSection } from './sidebar/SidebarShortcutsSection';

interface SidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export function Sidebar({ collapsed: _collapsed, onClose }: SidebarProps) {
  const { settings, updateSetting, getNavWidth } = useNavSidebarSettings();
  const { layout } = useSidebarLayout();

  const {
    navLayoutType,
    navCollapsed,
    navIconOnly,
    navActiveBg,
    navHoverBg,
    navDensity,
    navBordered,
    navBackground,
  } = settings;

  // TopNav slim
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
  const sectionSpacing = navDensity === 'compact' ? 'space-y-3' : navDensity === 'spacious' ? 'space-y-7' : 'space-y-5';
  const actualWidth = getNavWidth();

  const isBgLight = navBackground === 'bg-white' || navBackground === 'bg-slate-50';
  const textClass = isBgLight ? 'text-slate-800' : 'text-white';
  const borderClass = isBgLight ? 'border-slate-200' : 'border-slate-800/50';

  const handleToggleCollapse = () => {
    updateSetting('navCollapsed', !navCollapsed);
  };

  // المجموعات المرئية مرتّبة
  const visibleGroups = [...layout.groups]
    .filter(g => g.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <aside
      className={cn(
        "h-screen flex flex-col transition-all duration-300 ease-in-out relative",
        navBackground,
        textClass,
        navBordered ? `border-l ${borderClass}` : "border-none"
      )}
      style={{ width: actualWidth, minWidth: actualWidth }}
    >
      {/* Logo */}
      <SidebarLogo
        collapsed={isCollapsed}
        iconOnly={isIconOnly}
        onClose={onClose}
      />

      {/* Navigation */}
      <nav className={cn(
        "flex-1 overflow-y-auto scrollbar-hide px-2",
        densityPadding,
        sectionSpacing,
      )}>
        {/* قسم المثبتات */}
        <SidebarPinnedSection
          collapsed={isCollapsed}
          iconOnly={isIconOnly}
          activeBg={navActiveBg}
          hoverBg={navHoverBg}
          onClose={onClose}
        />

        {/* قسم الاختصارات السريعة */}
        <SidebarShortcutsSection
          collapsed={isCollapsed}
          iconOnly={isIconOnly}
          activeBg={navActiveBg}
          hoverBg={navHoverBg}
          onClose={onClose}
        />

        {/* المجموعات الديناميكية */}
        {visibleGroups.map(group => (
          <SidebarGroup
            key={group.id}
            group={group}
            collapsed={isCollapsed}
            iconOnly={isIconOnly}
            activeBg={navActiveBg}
            hoverBg={navHoverBg}
            onClose={onClose}
          />
        ))}
      </nav>


      {/* Collapse button */}
      <SidebarCollapseBtn
        collapsed={isCollapsed}
        onToggle={handleToggleCollapse}
      />

      {/* Footer */}
      <SidebarFooter
        collapsed={isCollapsed}
        iconOnly={isIconOnly}
      />
    </aside>
  );
}
