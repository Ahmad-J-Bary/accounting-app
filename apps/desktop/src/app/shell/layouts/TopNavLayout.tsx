import React from 'react';
import { useAppearance } from '@shared/hooks/useAppearance';
import { NavBar } from '../components/NavBar';

interface TopNavLayoutProps {
  children: React.ReactNode;
}

export function TopNavLayout({ children }: TopNavLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const showNavBar = settings.show.topBar && activeLayout.topBarMode !== 'hidden';

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-density={settings.density}>
      {showNavBar && (
        <NavBar
          slim
          horizontalAppearance={settings.horizontalNavbarAppearance}
        />
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
