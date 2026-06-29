import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTabs } from '@app/providers/TabContext';
import { useNavSidebarSettings, useSidebarLayout } from '@shared/hooks';
import { useAppearance } from '@shared/hooks/useAppearance';
import { cn } from '@shared/lib/utils';
import { ICON_MAP } from './sidebarConfig';
import { SidebarCollapseBtn } from './components/SidebarCollapseBtn';
import { SidebarGroup } from './sidebar/SidebarGroup';
import { SidebarPinnedSection } from './sidebar/SidebarPinnedSection';
import { SidebarShortcutsSection } from './sidebar/SidebarShortcutsSection';
import { SidebarItem } from './sidebar/SidebarItem';
import { FolderPlus, ChevronLeft } from 'lucide-react';

interface SidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export function Sidebar({ collapsed: _collapsed, onClose }: SidebarProps) {
  const { settings, updateSetting, getNavWidth } = useNavSidebarSettings();
  const { layout, toggleGroupCollapsed } = useSidebarLayout();
  const { openTab, updateMainTab, activeTabId } = useTabs();
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

  const { settings: appearanceSettings } = useAppearance();
  const { sidenavShape, verticalNavbarAppearance } = appearanceSettings;
  const isStacked = sidenavShape === 'stacked';

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

  // ── ملاحة مكدسة: المجموعة المحددة + تتبع المسار ──
  const [selectedStackedGroupId, setSelectedStackedGroupId] = useState<string | null>(() => {
    if (!isStacked) return null;
    return activeGroup?.id ?? visibleGroups[0]?.id ?? null;
  });

  useEffect(() => {
    if (isStacked && activeGroup) {
      setSelectedStackedGroupId(activeGroup.id);
    }
  }, [location.pathname, activeTabId, isStacked, activeGroup]);

  const isCollapsed = navCollapsed;
  const isIconOnly = navCollapsed && navIconOnly;
  const densityPadding = navDensity === 'compact' ? 'py-3' : navDensity === 'spacious' ? 'py-6' : 'py-4';
  const sectionSpacing = navDensity === 'compact' ? 'space-y-3' : navDensity === 'spacious' ? 'space-y-7' : 'space-y-5';
  const actualWidth = getNavWidth();

  const isBgLight = navBackground === 'bg-white' || navBackground === 'bg-slate-50';
  const isVerticalLight = verticalNavbarAppearance === 'light';
  const effectiveBg = isVerticalLight ? 'bg-slate-50' : navBackground;
  const effectiveTextClass = isVerticalLight
    ? 'text-slate-800'
    : isBgLight ? 'text-slate-800' : 'text-white';
  const effectiveBorderClass = isVerticalLight
    ? 'border-slate-200'
    : isBgLight ? 'border-slate-200' : 'border-slate-800/50';
  const effectiveActiveBg = isVerticalLight ? 'bg-primary/10' : navActiveBg;
  const effectiveHoverBg = isVerticalLight
    ? 'hover:bg-slate-100 hover:text-slate-700'
    : navHoverBg;

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

  // ── الوضع المكدس: شريط أيقونات ضيق + لوحة جانبية ──
  if (isStacked) {
    const selectedGroup = layout.groups.find(g => g.id === selectedStackedGroupId) ?? visibleGroups[0] ?? null;
    const isRailDark = verticalNavbarAppearance === 'dark';
    const railBg = isRailDark ? 'bg-slate-950' : 'bg-white';
    const railBorder = isRailDark ? 'border-slate-800' : 'border-slate-200';
    const railIconBase = isRailDark ? 'text-slate-500' : 'text-slate-400';
    const railIconHover = isRailDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-700';
    const railIconActive = isRailDark ? 'bg-blue-500/20 text-blue-400' : 'bg-primary/10 text-primary';

    return (
      <div className="flex h-full overflow-hidden sidebar-root" dir="rtl">
        {/* ── الرييل الضيق ── */}
        <div className={cn("flex flex-col items-center py-2 gap-0.5 w-11 shrink-0 border-l z-10", railBg, railBorder)}>
          {/* أيقونات المجموعات */}
          <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto sidebar-scrollbar px-0.5">
            {visibleGroups.map(group => {
              const isSelected = group.id === selectedGroup?.id;
              const GroupIcon = ICON_MAP[group.icon ?? ''] ?? FolderPlus;
              return (
                <button
                  key={group.id}
                  onClick={(e) => {
                    const visibleItems = group.items.filter(i => i.visible);
                    if (visibleItems.length === 1) {
                      const item = visibleItems[0];
                      if (item.to) {
                        if (e.ctrlKey) {
                          openTab({ id: `${item.to}-${Date.now()}`, title: item.customLabel ?? item.defaultLabel, path: item.to, closable: true });
                        } else {
                          updateMainTab({ title: item.customLabel ?? item.defaultLabel, path: item.to });
                        }
                      }
                    } else {
                      setSelectedStackedGroupId(group.id);
                    }
                  }}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all relative group/rail-btn",
                    isSelected ? railIconActive : railIconBase + ' ' + railIconHover,
                  )}
                  title={group.customTitle ?? group.defaultTitle}
                >
                  <GroupIcon className="w-3.5 h-3.5" />
                  {isSelected && (
                    <span className={cn("absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full", isRailDark ? 'bg-blue-400' : 'bg-primary')} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── اللوحة الجانبية ── */}
        <aside className={cn(
          "flex flex-col h-full overflow-hidden border-l transition-all duration-300",
          effectiveBg, effectiveTextClass, effectiveBorderClass,
        )} style={{ width: 200, minWidth: 200 }}>
          {selectedGroup && (
            <>
              {/* عنوان المجموعة */}
              <div className={cn("flex items-center gap-1.5 px-3 py-2 border-b shrink-0", effectiveBorderClass)}>
                <div className={cn(
                  "w-5 h-5 rounded flex items-center justify-center shrink-0",
                  isRailDark ? 'bg-blue-500/20 text-blue-400' : 'bg-primary/10 text-primary',
                )}>
                  {(() => {
                    const GI = ICON_MAP[selectedGroup.icon ?? ''] ?? FolderPlus;
                    return <GI className="w-3 h-3" />;
                  })()}
                </div>
                <span className="text-[11px] font-bold truncate">{selectedGroup.customTitle ?? selectedGroup.defaultTitle}</span>
              </div>
              {/* العناصر */}
              <nav className="flex-1 overflow-y-auto sidebar-scrollbar px-1.5 py-1 space-y-0.5">
                {selectedGroup.items.filter(i => i.visible).map(item => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    collapsed={false}
                    iconOnly={false}
                    activeBg={effectiveActiveBg}
                    hoverBg={effectiveHoverBg}
                    onClose={onClose}
                    verticalAppearance={verticalNavbarAppearance}
                  />
                ))}
              </nav>
            </>
          )}
        </aside>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "h-full flex flex-col transition-all duration-300 ease-in-out relative sidebar-root",
        effectiveBg,
        effectiveTextClass,
        navBordered ? `border-l ${effectiveBorderClass}` : "border-none"
      )}
      style={{ width: actualWidth, minWidth: actualWidth }}
    >
      {/* Navigation */}
      <nav className={cn(
        "flex-1 overflow-y-auto sidebar-scrollbar px-2",
        densityPadding,
        sectionSpacing,
      )}>
        {/* قسم المثبتات */}
        <SidebarPinnedSection
          collapsed={isCollapsed}
          iconOnly={isIconOnly}
          activeBg={effectiveActiveBg}
          hoverBg={effectiveHoverBg}
          onClose={onClose}
          verticalAppearance={verticalNavbarAppearance}
        />

        {/* قسم الاختصارات السريعة */}
        <SidebarShortcutsSection
          collapsed={isCollapsed}
          iconOnly={isIconOnly}
          activeBg={effectiveActiveBg}
          hoverBg={effectiveHoverBg}
          onClose={onClose}
          verticalAppearance={verticalNavbarAppearance}
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
              activeBg={effectiveActiveBg}
              hoverBg={effectiveHoverBg}
              isGroupCollapsed={isGroupCollapsed}
              onToggleCollapse={() => handleToggleGroup(group.id)}
              onClose={onClose}
              verticalAppearance={verticalNavbarAppearance}
            />
          );
        })}
      </nav>

      {/* Collapse button */}
      <SidebarCollapseBtn
        collapsed={isCollapsed}
        onToggle={handleToggleCollapse}
        verticalAppearance={verticalNavbarAppearance}
      />
    </aside>
  );
}
