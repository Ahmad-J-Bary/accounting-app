import React from 'react';
import { useNavSidebarSettings } from '@shared/hooks';
import { useAppearance } from '@shared/hooks/useAppearance';
import { NavBar } from '../components/NavBar';
import { TabBar } from '../TabBar';

interface TopNavLayoutProps {
  children: React.ReactNode;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function TopNavLayout({ children }: TopNavLayoutProps) {
  const { settings: navSettings } = useNavSidebarSettings();
  const { settings, activeLayout } = useAppearance();
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  return (
    <div className="flex flex-col h-screen overflow-hidden" dir="rtl" data-density={settings.density}>
      <NavBar
        slim={activeLayout.navbarMode === 'slim'}
        activeBg={navSettings.navActiveBg}
        hoverBg={navSettings.navHoverBg}
      />
      {showTabs && <TabBar />}
      <div className="flex-1 flex flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}
