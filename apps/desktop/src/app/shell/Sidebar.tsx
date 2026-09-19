import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTabs } from '@app/providers/TabContext';
import { useNavSidebarSettings, useCompanyTypeSettings, useCompanyInitState, useSidebarLayout, useNavLabels } from '@shared/hooks';
import { useAppearance } from '@shared/hooks/useAppearance';
import {
  companyTypeOf,
  hiddenNavIds,
} from '@modules/opening-balance/lib/company-lifecycle';
import { cn } from '@shared/lib/utils';
import { ICON_MAP } from './sidebarConfig';
import { SidebarCollapseBtn } from './components/SidebarCollapseBtn';
import { SidebarGroup } from './sidebar/SidebarGroup';
import { SidebarPinnedSection } from './sidebar/SidebarPinnedSection';
import { SidebarItem } from './sidebar/SidebarItem';
import { FolderPlus } from 'lucide-react';
import { useLocalization } from '@app/providers/LocalizationProvider';

interface SidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export function Sidebar({ collapsed: _collapsed, onClose }: SidebarProps) {
  const { settings, updateSetting, getNavWidth } = useNavSidebarSettings();
  const { layout, toggleGroupCollapsed } = useSidebarLayout();
  const companySettings = useCompanyTypeSettings();
  const { initState, isReady } = useCompanyInitState();
  const { openTab, updateMainTab, activeTabId } = useTabs();
  const { itemLabel, groupTitle } = useNavLabels();
  const { direction } = useLocalization();
  const location = useLocation();

  const {
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

  // Nav entries gated by company lifecycle: NEW hides opening items;
  // EXISTING hides transactional items until the migration is sealed, then hides
  // the opening items once ACTIVE. Until the state resolves we stay permissive.
  const hiddenItemIds = useMemo(
    () => hiddenNavIds(companyTypeOf(companySettings), isReady ? initState : 'ACTIVE'),
    [companySettings, initState, isReady],
  );

  // المجموعات المرئية مرتّبة (مع إخفاء عناصر نوع الشركة المنطبقة)
  const visibleGroups = [...layout.groups]
    .filter(g => g.visible)
    .map(g => ({ ...g, items: g.items.filter(i => !hiddenItemIds.has(i.id)) }))
    .filter(g => g.items.length > 0)
    .sort((a, b) => a.order - b.order);

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

  const isBgLight = navBackground === 'bg-white' || navBackground === 'bg-muted';
  const isVerticalLight = verticalNavbarAppearance === 'light';
  const effectiveBg = isVerticalLight ? 'bg-muted' : navBackground;
  const effectiveTextClass = isVerticalLight
    ? 'text-foreground'
    : isBgLight ? 'text-foreground' : 'text-white';
  const effectiveBorderClass = isVerticalLight
    ? 'border-muted'
    : isBgLight ? 'border-muted' : 'border-slate-800/50';
  const effectiveActiveBg = isVerticalLight ? 'bg-primary/10' : navActiveBg;
  const effectiveHoverBg = isVerticalLight
    ? 'hover:bg-muted hover:text-foreground'
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

  // ── الوضع المكدس: شريط أيقونات ضيق + لوحة جانبية ──
  if (isStacked) {
    const selectedGroup = visibleGroups.find(g => g.id === selectedStackedGroupId) ?? visibleGroups[0] ?? null;
    const isRailDark = verticalNavbarAppearance === 'dark';
    const railBg = isRailDark ? 'bg-slate-950' : 'bg-white';
    const railBorder = isRailDark ? 'border-slate-800' : 'border-muted';
    const railIconBase = isRailDark ? 'text-muted-foreground' : 'text-muted-foreground';
    const railIconHover = isRailDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-muted hover:text-foreground';
    const railIconActive = isRailDark ? 'bg-primary/100/20 text-primary' : 'bg-primary/10 text-primary';

    return (
      <div className="sidebar-root flex h-full min-h-0 overflow-hidden" dir={direction}>
        {/* ── الرييل الضيق ── */}
        <div className={cn("z-10 flex w-11 shrink-0 flex-col items-center gap-0.5 border-s py-2", railBg, railBorder)}>
          {/* أيقونات المجموعات */}
          <nav className="sidebar-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-0.5">
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
                          openTab({ id: `${item.to}-${Date.now()}`, title: itemLabel(item), path: item.to, closable: true });
                        } else {
                          updateMainTab({ title: itemLabel(item), path: item.to });
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
                  title={groupTitle(group)}
                >
                  <GroupIcon className="w-3.5 h-3.5" />
                  {isSelected && (
                    <span className={cn("absolute end-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full", isRailDark ? 'bg-blue-400' : 'bg-primary')} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── اللوحة الجانبية ── */}
        <aside className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden border-s transition-all duration-300",
          effectiveBg, effectiveTextClass, effectiveBorderClass,
        )} style={{ width: 200, minWidth: 200 }}>
          {selectedGroup && (
            <>
              {/* عنوان المجموعة */}
              <div className={cn("flex items-center gap-1.5 px-3 py-2 border-b shrink-0", effectiveBorderClass)}>
                <div className={cn(
                  "w-5 h-5 rounded flex items-center justify-center shrink-0",
                  isRailDark ? 'bg-primary/100/20 text-primary' : 'bg-primary/10 text-primary',
                )}>
                  {(() => {
                    const GI = ICON_MAP[selectedGroup.icon ?? ''] ?? FolderPlus;
                    return <GI className="w-3 h-3" />;
                  })()}
                </div>
                <span className="truncate text-[11px] font-bold">{groupTitle(selectedGroup)}</span>
              </div>
              {/* العناصر */}
              <nav className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1 space-y-0.5">
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
        "sidebar-root relative flex h-full min-h-0 flex-col transition-all duration-300 ease-in-out",
        effectiveBg,
        effectiveTextClass,
        navBordered ? `border-s ${effectiveBorderClass}` : "border-none"
      )}
      style={{ width: actualWidth, minWidth: actualWidth }}
    >
      {/* Navigation */}
      <nav className={cn(
        "sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2",
        densityPadding,
        sectionSpacing,
      )}>
        {/* قسم المثبتات */}
        <SidebarPinnedSection
          collapsed={isCollapsed}
          iconOnly={isIconOnly}
          activeBg={effectiveActiveBg}
          hoverBg={effectiveHoverBg}
          hiddenItemIds={hiddenItemIds}
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
              group={{ ...group, items: group.items.filter(i => !i.isSeparator) }}
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
