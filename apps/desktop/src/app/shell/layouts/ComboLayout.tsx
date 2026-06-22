import React from 'react';
import { Sidebar } from '../Sidebar';
import { TopBar } from '../TopBar';
import { TabBar } from '../TabBar';
import { useAppearance } from '@shared/hooks/useAppearance';
import { useNavSidebarSettings } from '@shared/hooks';
import { NavBar } from '../components/NavBar';

interface ComboLayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function ComboLayout({ children, sidebarOpen, onToggleSidebar, isExchangeVisible, onToggleExchange }: ComboLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const { settings: navSettings } = useNavSidebarSettings();
  const showTopBar = settings.show.topBar && activeLayout.topBarMode !== 'hidden';
  const showNavBar = activeLayout.navbarMode !== 'none';
  const showSidebar = settings.show.sidebar && activeLayout.sidebarMode !== 'hidden';
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  return (
    <div className="flex flex-col h-screen overflow-hidden" dir="rtl" data-density={settings.density}>
      {showTopBar && <TopBar onToggleSidebar={onToggleSidebar} sidebarOpen={sidebarOpen} isExchangeVisible={isExchangeVisible} onToggleExchange={onToggleExchange} />}
      <div className="flex flex-1 overflow-hidden">
        {showNavBar && (
          <div className="flex flex-col shrink-0">
            <NavBar
              slim={activeLayout.navbarMode === 'slim'}
              activeBg={navSettings.navActiveBg}
              hoverBg={navSettings.navHoverBg}
              vertical
            />
          </div>
        )}
        {showSidebar && (
          <Sidebar collapsed={!sidebarOpen} onClose={() => sidebarOpen && onToggleSidebar()} />
        )}
        <div className="flex flex-col flex-1 min-w-0">
          {showTabs && <TabBar />}
          <div className="flex-1 flex flex-col overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
