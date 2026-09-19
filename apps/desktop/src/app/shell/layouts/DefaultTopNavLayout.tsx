import React from 'react';
import { useAppearance } from '@shared/hooks/useAppearance';
import { TopBar } from '../TopBar';
import { TabBar } from '../TabBar';
import { useLocalization } from '@app/providers/LocalizationProvider';

interface DefaultTopNavLayoutProps {
  children: React.ReactNode;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function DefaultTopNavLayout({ children, isExchangeVisible, onToggleExchange }: DefaultTopNavLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const { direction } = useLocalization();
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  return (
    <div className="flex h-full flex-col overflow-hidden" dir={direction} data-density={settings.density}>
      <TopBar
        onToggleSidebar={() => {}}
        sidebarOpen={false}
        isExchangeVisible={isExchangeVisible}
        onToggleExchange={onToggleExchange}
        merged
        mergedSlim
      />
      {showTabs && <TabBar />}
      <div className="flex flex-1 flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}
