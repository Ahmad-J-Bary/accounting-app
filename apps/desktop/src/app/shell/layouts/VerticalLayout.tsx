import React from 'react';
import { Sidebar } from '../Sidebar';
import { useAppearance } from '@shared/hooks/useAppearance';

interface VerticalLayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function VerticalLayout({ children, sidebarOpen, onToggleSidebar }: VerticalLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const showSidebar = settings.show.sidebar && activeLayout.sidebarMode !== 'hidden';

  return (
    <div className="flex flex-1 overflow-hidden" data-density={settings.density}>
      {showSidebar && (
        <Sidebar collapsed={!sidebarOpen} onClose={() => sidebarOpen && onToggleSidebar()} />
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}
