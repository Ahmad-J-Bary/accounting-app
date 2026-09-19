import React from 'react';
import { Sidebar } from '../Sidebar';
import { useAppearance } from '@shared/hooks/useAppearance';
import { NavBar } from '../components/NavBar';

interface ComboLayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function ComboLayout({ children, sidebarOpen, onToggleSidebar }: ComboLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const isStacked = settings.topnavShape === 'stacked';
  const showNavBar = isStacked && activeLayout.navbarMode !== 'none';
  const showSidebar = settings.show.sidebar && activeLayout.sidebarMode !== 'hidden';
  const showAppNav = settings.show.topBar && activeLayout.topBarMode !== 'hidden';

  return (
    <div className="flex flex-1 overflow-hidden" data-density={settings.density}>
      <div className="flex min-w-0 flex-1 overflow-hidden">
        {showSidebar && (
          <Sidebar collapsed={!sidebarOpen} onClose={() => sidebarOpen && onToggleSidebar()} />
        )}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {showNavBar && showAppNav && (
        <NavBar
          slim={activeLayout.navbarMode === 'slim'}
          horizontalAppearance={settings.horizontalNavbarAppearance}
        />
          )}
          <div className="min-h-0 flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
