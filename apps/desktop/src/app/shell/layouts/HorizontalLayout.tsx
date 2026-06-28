import React from 'react';
import { TopBar } from '../TopBar';
import { TabBar } from '../TabBar';
import { FullBannerSlot } from '../FullBannerSlot';
import { useAppearance } from '@shared/hooks/useAppearance';
import { NavBar } from '../components/NavBar';

interface HorizontalLayoutProps {
  children: React.ReactNode;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function HorizontalLayout({ children, isExchangeVisible, onToggleExchange }: HorizontalLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const isStacked = activeLayout.id === 'horizontal-slim' || settings.topnavShape === 'stacked';
  const showTopBar = settings.show.topBar && activeLayout.topBarMode !== 'hidden';
  const showNavBar = activeLayout.navbarMode !== 'none';
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  if (isStacked) {
    return (
      <div className="flex flex-col h-screen overflow-hidden" dir="rtl" data-density={settings.density}>
        {showTopBar && <TopBar onToggleSidebar={() => {}} sidebarOpen={false} isExchangeVisible={isExchangeVisible} onToggleExchange={onToggleExchange} />}
        {showNavBar && (
          <NavBar
            slim={activeLayout.navbarMode === 'slim'}
            activeBg="bg-blue-600"
            hoverBg="hover:bg-white/5 hover:text-white"
            horizontalAppearance={settings.horizontalNavbarAppearance}
          />
        )}
        <FullBannerSlot />
        {showTabs && <TabBar />}
        <div className="flex-1 flex flex-col overflow-auto">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" dir="rtl" data-density={settings.density}>
      <TopBar
        onToggleSidebar={() => {}}
        sidebarOpen={false}
        isExchangeVisible={isExchangeVisible}
        onToggleExchange={onToggleExchange}
        merged
        mergedSlim={activeLayout.navbarMode === 'slim'}
      />
      <FullBannerSlot />
      {showTabs && <TabBar />}
      <div className="flex-1 flex flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}
