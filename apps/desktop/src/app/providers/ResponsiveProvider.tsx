import React from 'react';
import { useResponsive } from '@shared/hooks/useResponsive';
import { ResponsiveContext } from '@shared/hooks/useResponsiveContext';

export function ResponsiveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const mode = useResponsive();

  return (
    <ResponsiveContext.Provider
      value={{
        mode,
        isMobile: mode === 'mobile',
        isTablet: mode === 'tablet',
        isLaptop: mode === 'laptop',
        isDesktop: mode === 'desktop' || mode === 'laptop',
        isWide: mode === 'wide',
        isLegacyMobile: mode === 'mobile',
      }}
    >
      {children}
    </ResponsiveContext.Provider>
  );
}
