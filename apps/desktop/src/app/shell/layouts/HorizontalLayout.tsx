import React from 'react';
import { TopBar } from '../TopBar';
import { TabBar } from '../TabBar';
import { useAppearance } from '@shared/hooks/useAppearance';
import { useNavSidebarSettings } from '@shared/hooks';
import { NavBar } from '../components/NavBar';

interface HorizontalLayoutProps {
  children: React.ReactNode;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function HorizontalLayout({ children, isExchangeVisible, onToggleExchange }: HorizontalLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const { settings: navSettings } = useNavSidebarSettings();
  const showTopBar = settings.show.topBar && activeLayout.topBarMode !== 'hidden';
  const showNavBar = activeLayout.navbarMode !== 'none';
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  return (
    <div className="flex flex-col h-screen overflow-hidden" dir="rtl" data-density={settings.density}>
      {showTopBar && <TopBar onToggleSidebar={() => {}} sidebarOpen={false} isExchangeVisible={isExchangeVisible} onToggleExchange={onToggleExchange} />}
      {showNavBar && (
        <NavBar
          slim={activeLayout.navbarMode === 'slim'}
          activeBg={navSettings.navActiveBg}
          hoverBg={navSettings.navHoverBg}
        />
      )}
      {showTabs && <TabBar />}
      <div className="flex-1 flex flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}
