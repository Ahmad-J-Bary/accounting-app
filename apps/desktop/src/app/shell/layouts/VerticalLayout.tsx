import React from 'react';
import { Sidebar } from '../Sidebar';
import { TopBar } from '../TopBar';
import { TabBar } from '../TabBar';
import { useAppearance } from '@shared/hooks/useAppearance';
import { cn } from '@shared/lib/utils';

interface VerticalLayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function VerticalLayout({ children, sidebarOpen, onToggleSidebar, isExchangeVisible, onToggleExchange }: VerticalLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const showSidebar = settings.show.sidebar && activeLayout.sidebarMode !== 'hidden';
  const showTopBar = settings.show.topBar && activeLayout.topBarMode !== 'hidden';
  const showTabs = settings.show.tabs && activeLayout.showTabs;

  return (
    <div className="flex flex-col h-screen overflow-hidden" dir="rtl" data-density={settings.density}>
      {showTopBar && <TopBar onToggleSidebar={onToggleSidebar} sidebarOpen={sidebarOpen} isExchangeVisible={isExchangeVisible} onToggleExchange={onToggleExchange} />}
      <div className="flex flex-1 overflow-hidden">
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
