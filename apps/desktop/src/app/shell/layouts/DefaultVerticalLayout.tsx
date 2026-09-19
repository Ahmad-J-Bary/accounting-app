import React from 'react';
import { Sidebar } from '../Sidebar';
import { TopBar } from '../TopBar';
import { TabBar } from '../TabBar';
import { useAppearance } from '@shared/hooks/useAppearance';
import { useLocalization } from '@app/providers/LocalizationProvider';

interface DefaultVerticalLayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function DefaultVerticalLayout({
  children,
  sidebarOpen,
  onToggleSidebar,
  isExchangeVisible,
  onToggleExchange,
}: DefaultVerticalLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const { direction } = useLocalization();
  const showSidebar = settings.show.sidebar && activeLayout.sidebarMode !== 'hidden';
  const showTopBar = settings.show.topBar && activeLayout.topBarMode !== 'hidden';
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  return (
    <div className="flex h-full flex-col overflow-hidden" dir={direction} data-density={settings.density}>
      {showTopBar && (
        <TopBar
          onToggleSidebar={onToggleSidebar}
          sidebarOpen={sidebarOpen}
          isExchangeVisible={isExchangeVisible}
          onToggleExchange={onToggleExchange}
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <Sidebar collapsed={!sidebarOpen} onClose={() => sidebarOpen && onToggleSidebar()} />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {showTabs && <TabBar />}
          <div className="flex flex-1 flex-col overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
