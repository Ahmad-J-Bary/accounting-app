import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTabs } from '@app/providers/TabContext';
import { useCompanyTypeSettings, useCompanyInitState, useSidebarLayout } from '@shared/hooks';
import { companyTypeOf, hiddenNavIds } from '@modules/opening-balance/lib/company-lifecycle';
import { cn } from '@shared/lib/utils';
import { ICON_MAP } from '../sidebarConfig';
import { ChevronDown } from 'lucide-react';

interface NavBarProps {
  slim?: boolean;
  activeBg?: string;
  hoverBg?: string;
  vertical?: boolean;
  horizontalAppearance?: 'light' | 'dark';
}

export function NavBar({ slim = false, activeBg = 'bg-blue-600', hoverBg = 'hover:bg-white/5 hover:text-white', vertical = false, horizontalAppearance }: NavBarProps) {
  const { layout } = useSidebarLayout();
  const companySettings = useCompanyTypeSettings();
  const { initState, isReady } = useCompanyInitState();
  const hiddenItemIds = hiddenNavIds(companyTypeOf(companySettings), isReady ? initState : 'ACTIVE');
  const { openTab, updateMainTab, activeTabId } = useTabs();
  const location = useLocation();
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const isHorizLight = horizontalAppearance === 'light';

  const visibleGroups = layout.groups.filter(g => g.visible).sort((a, b) => a.order - b.order);

  if (vertical) {
    return (
      <nav
        className="flex flex-col h-full border-l border-[hsl(var(--sidebar-border))] py-2 px-1 space-y-1"
        style={{ background: 'hsl(var(--sidebar-background))' }}
        dir="rtl"
      >
        {visibleGroups.map(group => (
          <div key={group.id} className="relative">
            <button
              onMouseEnter={() => setHoveredGroup(group.id)}
              onMouseLeave={() => setHoveredGroup(null)}
              className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
              title={group.customTitle ?? group.defaultTitle}
            >
              {group.icon && ICON_MAP[group.icon] ? (
                <span className="w-4 h-4">{React.createElement(ICON_MAP[group.icon], { className: "w-4 h-4" })}</span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            {/* Tooltip on hover */}
            {hoveredGroup === group.id && (
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 px-2 py-1 text-[10px] font-bold text-white bg-slate-700 rounded shadow-lg whitespace-nowrap pointer-events-none">
                {group.customTitle ?? group.defaultTitle}
              </div>
            )}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav
      className={cn(
        "flex items-center justify-center gap-2 px-4 border-b overflow-visible z-50",
        isHorizLight
          ? "bg-white border-slate-200"
          : "border-[hsl(var(--sidebar-border))]",
        slim ? "h-10" : "h-12"
      )}
      style={!isHorizLight ? { background: 'hsl(var(--sidebar-background))' } : undefined}
      dir="rtl"
    >
      {visibleGroups.map(group => {
        const displayGroupTitle = group.customTitle ?? group.defaultTitle;
        const visibleItems = group.items.filter(i => !hiddenItemIds.has(i.id)).filter(i => i.visible).sort((a, b) => a.order - b.order);
        if (visibleItems.length === 0) return null;

        const nonSeparatorItems = visibleItems.filter(i => !i.isSeparator);
        if (nonSeparatorItems.length === 0) return null;
        const GroupIcon = group.icon ? ICON_MAP[group.icon] ?? null : null;

        // If the group contains exactly 1 non-separator item, render it directly without a dropdown
        if (nonSeparatorItems.length === 1) {
          const item = nonSeparatorItems[0];
          const isActive = activeTabId === item.to || location.pathname === item.to;
          const ItemIcon = ICON_MAP[item.icon] ?? null;
          const displayLabel = item.customLabel ?? item.defaultLabel;

          const handleClick = (e: React.MouseEvent) => {
            e.preventDefault();
            if (e.ctrlKey) {
              openTab({ id: `${item.to}-${Date.now()}`, title: displayLabel, path: item.to, closable: true });
            } else {
              updateMainTab({ title: displayLabel, path: item.to });
            }
          };

          return (
            <button
              key={item.id}
              onClick={handleClick}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                isActive
                  ? isHorizLight ? "text-primary bg-primary/10" : `${activeBg} text-white shadow-sm`
                  : isHorizLight
                    ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    : `text-[hsl(var(--sidebar-foreground))] opacity-75 hover:opacity-100 hover:bg-[hsl(var(--sidebar-accent))]`
              )}
              title={displayLabel}
            >
              {ItemIcon && !slim && <ItemIcon className="w-3.5 h-3.5 opacity-80" />}
              <span className={cn(slim ? "text-[10px]" : "text-xs")}>{displayLabel}</span>
            </button>
          );
        }

        // Check if any of the items in this group is currently active
        const isGroupActive = visibleItems.some(
          item => activeTabId === item.to || location.pathname === item.to
        );

        return (
          <div
            key={group.id}
            className="relative group py-1"
          >
            {/* Group Trigger Button */}
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                isGroupActive
                  ? isHorizLight ? "text-primary bg-primary/10" : "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] opacity-100 shadow-sm"
                  : isHorizLight
                    ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    : "text-[hsl(var(--sidebar-foreground))] opacity-75 hover:opacity-100 hover:bg-[hsl(var(--sidebar-accent))]"
              )}
            >
              {GroupIcon && !slim && <GroupIcon className="w-3.5 h-3.5 opacity-80" />}
              <span className={cn(slim ? "text-[10px]" : "text-xs")}>{displayGroupTitle}</span>
              <ChevronDown className="w-3 h-3 opacity-60 group-hover:rotate-180 transition-transform duration-200" />
            </button>

            {/* Dropdown Menu (on hover) */}
            <div
              className={cn(
                "absolute top-full right-0 mt-1 w-56 rounded-xl border p-1.5 shadow-xl opacity-0 translate-y-1 invisible",
                "group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-all duration-200 z-50",
                isHorizLight ? "bg-white border-slate-200" : "border-[hsl(var(--sidebar-border))]"
              )}
              style={!isHorizLight ? { background: 'hsl(var(--sidebar-background))' } : undefined}
            >
              <div className="space-y-0.5">
                {visibleItems.map((item, idx) => {
                  if (item.isSeparator) {
                    return (
                      <div key={item.id || idx} className="h-px mx-2 my-1.5 bg-slate-200/50" />
                    );
                  }

                  const isActive = activeTabId === item.to || location.pathname === item.to;
                  const ItemIcon = ICON_MAP[item.icon] ?? null;
                  const displayLabel = item.customLabel ?? item.defaultLabel;

                  const handleClick = (e: React.MouseEvent) => {
                    e.preventDefault();
                    if (e.ctrlKey) {
                      openTab({ id: `${item.to}-${Date.now()}`, title: displayLabel, path: item.to, closable: true });
                    } else {
                      updateMainTab({ title: displayLabel, path: item.to });
                    }
                  };

                  return (
                    <button
                      key={item.id}
                      onClick={handleClick}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right text-xs font-bold transition-all",
                        isActive
                          ? isHorizLight ? "text-primary bg-primary/10" : `${activeBg} text-white shadow-sm`
                          : isHorizLight
                            ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            : `text-[hsl(var(--sidebar-foreground))] opacity-75 hover:opacity-100 ${hoverBg}`
                      )}
                    >
                      {ItemIcon && <ItemIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />}
                      <span className="truncate">{displayLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
