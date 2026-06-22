import React, { useState } from 'react';
import { useAppearance } from '@shared/hooks/useAppearance';
import { useNavSidebarSettings, useSidebarLayout } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import type { SidebarGroupConfig } from '@shared/types/sidebar-config';

import { TopBar } from '../TopBar';
import { TabBar } from '../TabBar';
import { ICON_MAP } from '../sidebarConfig';

interface DualLayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function DualLayout({
  children,
  sidebarOpen,
  onToggleSidebar,
  isExchangeVisible,
  onToggleExchange,
}: DualLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const { settings: navSettings } = useNavSidebarSettings();
  const { layout } = useSidebarLayout();

  const showTopBar = settings.show.topBar && activeLayout.topBarMode !== 'hidden';
  const showSidebar = settings.show.sidebar && activeLayout.sidebarMode !== 'hidden';
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  // The visible groups from the sidebar layout
  const visibleGroups = layout.groups
    .filter((g: SidebarGroupConfig) => g.visible)
    .sort((a: SidebarGroupConfig, b: SidebarGroupConfig) => a.order - b.order);

  const [activeGroup, setActiveGroup] = useState<string | null>(
    visibleGroups[0]?.id ?? null
  );

  return (
    <div
      className="flex h-screen overflow-hidden"
      dir="rtl"
      data-density={settings.density}
    >
      {/* ── Primary vertical icon rail (group switcher) ── */}
      {showSidebar && (
        <nav
          className="flex flex-col shrink-0 w-14 border-l border-[hsl(var(--sidebar-border))] py-2 items-center gap-1"
          style={{ background: 'hsl(var(--sidebar-background))' }}
        >
          {visibleGroups.map((group: SidebarGroupConfig) => {
            const Icon = ICON_MAP[group.icon] ?? null;
            const isActive = activeGroup === group.id;
            return (
              <button
                key={group.id}
                onClick={() => setActiveGroup(group.id)}
                title={group.customTitle ?? group.defaultTitle}
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                  isActive
                    ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
                    : 'text-[hsl(var(--sidebar-foreground))] opacity-60 hover:opacity-100 hover:bg-[hsl(var(--sidebar-accent))]'
                )}
              >
                {Icon ? (
                  <Icon className="w-4 h-4" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* ── Secondary panel: items for the active group ── */}
      {showSidebar && activeGroup && (() => {
        const group = visibleGroups.find((g: SidebarGroupConfig) => g.id === activeGroup);
        if (!group) return null;
        const groupItems = group.items
          .filter(i => i.visible)
          .sort((a, b) => a.order - b.order);

        return (
          <div
            className="flex flex-col shrink-0 w-48 border-l border-[hsl(var(--sidebar-border))]"
            style={{ background: 'hsl(var(--sidebar-background))' }}
          >
            {/* Group header */}
            <div
              className="flex items-center justify-between px-3 h-12 border-b border-[hsl(var(--sidebar-border))] shrink-0"
            >
              <span
                className="text-xs font-black truncate"
                style={{ color: 'hsl(var(--sidebar-foreground))' }}
              >
                {group.customTitle ?? group.defaultTitle}
              </span>
              <button
                onClick={onToggleSidebar}
                className="p-1 rounded-lg hover:bg-[hsl(var(--sidebar-accent))] transition-colors shrink-0"
                style={{ color: 'hsl(var(--sidebar-foreground))' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Group items */}
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {groupItems.map(item => {
                const ItemIcon = ICON_MAP[item.icon] ?? null;
                const label = item.customLabel ?? item.defaultLabel;
                return (
                  <button
                    key={item.id}
                    className="w-full text-right flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors truncate"
                    style={{ color: 'hsl(var(--sidebar-foreground))', opacity: 0.7 }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'hsl(var(--sidebar-accent))';
                      (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.opacity = '0.7';
                    }}
                  >
                    {ItemIcon && <ItemIcon className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        );
      })()}

      {/* ── Main content area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {showTopBar && (
          <TopBar
            onToggleSidebar={onToggleSidebar}
            sidebarOpen={sidebarOpen}
            isExchangeVisible={isExchangeVisible}
            onToggleExchange={onToggleExchange}
          />
        )}
        {showTabs && <TabBar />}
        <div className="flex-1 flex flex-col overflow-auto">{children}</div>
      </div>
    </div>
  );
}
