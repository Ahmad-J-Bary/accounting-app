import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTabs } from '@app/providers/TabContext';
import { useNavSidebarSettings, useSidebarLayout } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { NAV_GROUPS } from './sidebarConfig';
import { SidebarLogo } from './components/SidebarLogo';
import { SidebarCollapseBtn } from './components/SidebarCollapseBtn';
import { SidebarFooter } from './components/SidebarFooter';
import { SidebarGroup } from './sidebar/SidebarGroup';
import { SidebarPinnedSection } from './sidebar/SidebarPinnedSection';
import { SidebarShortcutsSection } from './sidebar/SidebarShortcutsSection';

interface SidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export function Sidebar({ collapsed: _collapsed, onClose }: SidebarProps) {
  const { settings, updateSetting, getNavWidth } = useNavSidebarSettings();
  const { layout, toggleGroupCollapsed } = useSidebarLayout();
  const { activeTabId } = useTabs();
  const location = useLocation();

  const {
    navLayoutType,
    navCollapsed,
    navIconOnly,
    navActiveBg,
    navHoverBg,
    navDensity,
    navBordered,
    navBackground,
    navGroupCollapseBehavior = 'free',
  } = settings;

  // البحث عن المجموعة النشطة حالياً بناءً على الصفحة المفتوحة
  const activeGroup = layout.groups.find(g =>
    g.items.some(item => activeTabId === item.to || location.pathname === item.to)
  );

  // حالة المجموعة المفتوحة في وضع الأكورديون (Accordion)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(() => {
    if (navGroupCollapseBehavior !== 'accordion') return null;
    return activeGroup ? activeGroup.id : null;
  });

  // مزامنة المجموعة النشطة عند تغيير الصفحة في وضع الأكورديون
  useEffect(() => {
    if (navGroupCollapseBehavior === 'accordion' && activeGroup) {
      setExpandedGroupId(activeGroup.id);
    }
  }, [location.pathname, activeTabId, navGroupCollapseBehavior, activeGroup]);

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

  const handleToggleGroup = (groupId: string) => {
    if (navGroupCollapseBehavior === 'accordion') {
      setExpandedGroupId(prev => prev === groupId ? null : groupId);
    } else if (navGroupCollapseBehavior === 'free') {
      toggleGroupCollapsed(groupId);
    }
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
        {visibleGroups.map(group => {
          const isGroupCollapsed =
            navGroupCollapseBehavior === 'all-expanded'
              ? false
              : navGroupCollapseBehavior === 'accordion'
              ? expandedGroupId !== group.id
              : group.collapsed;

          return (
            <SidebarGroup
              key={group.id}
              group={group}
              collapsed={isCollapsed}
              iconOnly={isIconOnly}
              activeBg={navActiveBg}
              hoverBg={navHoverBg}
              isGroupCollapsed={isGroupCollapsed}
              onToggleCollapse={() => handleToggleGroup(group.id)}
              onClose={onClose}
            />
          );
        })}
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
