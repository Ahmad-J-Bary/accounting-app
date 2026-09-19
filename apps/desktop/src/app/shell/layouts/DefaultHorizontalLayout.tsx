import React from 'react';
import { TopBar } from '../TopBar';
import { TabBar } from '../TabBar';
import { useAppearance } from '@shared/hooks/useAppearance';
import { NavBar } from '../components/NavBar';
import { useLocalization } from '@app/providers/LocalizationProvider';

interface DefaultHorizontalLayoutProps {
  children: React.ReactNode;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function DefaultHorizontalLayout({ children, isExchangeVisible, onToggleExchange }: DefaultHorizontalLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const { direction } = useLocalization();
  const isStacked = activeLayout.id === 'horizontal-slim' || settings.topnavShape === 'stacked';
  const showTopBar = settings.show.topBar && activeLayout.topBarMode !== 'hidden';
  const showNavBar = activeLayout.navbarMode !== 'none';
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  if (isStacked) {
    return (
      <div className="flex h-full flex-col overflow-hidden" dir={direction} data-density={settings.density}>
        {showTopBar && (
          <TopBar
            onToggleSidebar={() => {}}
            sidebarOpen={false}
            isExchangeVisible={isExchangeVisible}
            onToggleExchange={onToggleExchange}
          />
        )}
        {showNavBar && (
          <NavBar
            slim={activeLayout.navbarMode === 'slim'}
            activeBg="bg-primary"
            hoverBg="hover:bg-white/5 hover:text-white"
            horizontalAppearance={settings.horizontalNavbarAppearance}
          />
        )}
        {showTabs && <TabBar />}
        <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" dir={direction} data-density={settings.density}>
      <TopBar
        onToggleSidebar={() => {}}
        sidebarOpen={false}
        isExchangeVisible={isExchangeVisible}
        onToggleExchange={onToggleExchange}
        merged
        mergedSlim={activeLayout.navbarMode === 'slim'}
      />
      {showTabs && <TabBar />}
      <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
