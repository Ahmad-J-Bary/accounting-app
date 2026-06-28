import React from 'react';
import { useAppearance } from '@shared/hooks/useAppearance';
import { TopBar } from '../TopBar';
import { TabBar } from '../TabBar';
import { FullBannerSlot } from '../FullBannerSlot';

interface TopNavLayoutProps {
  children: React.ReactNode;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function TopNavLayout({ children, isExchangeVisible, onToggleExchange }: TopNavLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  return (
    <div className="flex flex-col h-screen overflow-hidden" dir="rtl" data-density={settings.density}>
      <TopBar
        onToggleSidebar={() => {}}
        sidebarOpen={false}
        isExchangeVisible={isExchangeVisible}
        onToggleExchange={onToggleExchange}
        merged
        mergedSlim
      />
      <FullBannerSlot />
      {showTabs && <TabBar />}
      <div className="flex-1 flex flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}
