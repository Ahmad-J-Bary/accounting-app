import React from 'react';
import { Sidebar } from '../Sidebar';
import { TopBar } from '../TopBar';
import { TabBar } from '../TabBar';
import { useAppearance } from '@shared/hooks/useAppearance';
import { NavBar } from '../components/NavBar';
import { useLocalization } from '@app/providers/LocalizationProvider';

interface DefaultComboLayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function DefaultComboLayout({
  children,
  sidebarOpen,
  onToggleSidebar,
  isExchangeVisible,
  onToggleExchange,
}: DefaultComboLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const { direction } = useLocalization();
  const isStacked = settings.topnavShape === 'stacked';
  const showTopBar = settings.show.topBar && activeLayout.topBarMode !== 'hidden';
  const showNavBar = isStacked && activeLayout.navbarMode !== 'none';
  const showSidebar = settings.show.sidebar && activeLayout.sidebarMode !== 'hidden';
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  return (
    <div className="flex h-full flex-col overflow-hidden" dir={direction} data-density={settings.density}>
      {showTopBar && (
        isStacked ? (
          <TopBar
            onToggleSidebar={onToggleSidebar}
            sidebarOpen={sidebarOpen}
            isExchangeVisible={isExchangeVisible}
            onToggleExchange={onToggleExchange}
          />
        ) : (
          <TopBar
            onToggleSidebar={onToggleSidebar}
            sidebarOpen={sidebarOpen}
            isExchangeVisible={isExchangeVisible}
            onToggleExchange={onToggleExchange}
            merged
            mergedSlim={activeLayout.navbarMode === 'slim'}
          />
        )
      )}
      {showNavBar && (
        <NavBar
          slim={activeLayout.navbarMode === 'slim'}
          horizontalAppearance={settings.horizontalNavbarAppearance}
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <Sidebar collapsed={!sidebarOpen} onClose={() => sidebarOpen && onToggleSidebar()} />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showTabs && <TabBar />}
          <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
