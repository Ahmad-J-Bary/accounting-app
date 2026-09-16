import { createContext, useContext } from 'react';
import type { ResponsiveMode } from '@shared/hooks/useResponsive';

interface ResponsiveContextType {
  mode: ResponsiveMode;
  isMobile: boolean;
  isTablet: boolean;
  isLaptop: boolean;
  isDesktop: boolean;
  isWide: boolean;
  /** @deprecated Use isMobile or mode === 'mobile' instead */
  isLegacyMobile: boolean;
}

export const ResponsiveContext = createContext<ResponsiveContextType>({
  mode: 'desktop',
  isMobile: false,
  isTablet: false,
  isLaptop: true,
  isDesktop: true,
  isWide: false,
  isLegacyMobile: false,
});

export function useResponsiveContext() {
  return useContext(ResponsiveContext);
}
