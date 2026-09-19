import React from 'react';
import { useAppearance } from '@shared/hooks/useAppearance';
import { NavBar } from '../components/NavBar';

interface HorizontalLayoutProps {
  children: React.ReactNode;
}

export function HorizontalLayout({ children }: HorizontalLayoutProps) {
  const { settings, activeLayout } = useAppearance();
  const isStacked = activeLayout.id === 'horizontal-slim' || settings.topnavShape === 'stacked';
  const showNavBar = activeLayout.navbarMode !== 'none';
  const showAppNav = settings.show.topBar && activeLayout.topBarMode !== 'hidden';

  if (isStacked) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-density={settings.density}>
        {showNavBar && showAppNav && (
          <NavBar
            slim={activeLayout.navbarMode === 'slim'}
            activeBg="bg-primary"
            hoverBg="hover:bg-white/5 hover:text-white"
            horizontalAppearance={settings.horizontalNavbarAppearance}
          />
        )}
        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-density={settings.density}>
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
  );
}
