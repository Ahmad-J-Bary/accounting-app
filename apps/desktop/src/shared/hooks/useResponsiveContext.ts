import { createContext, useContext } from 'react';
import type { ResponsiveMode } from '@shared/hooks/useResponsive';

interface ResponsiveContextType {
  mode: ResponsiveMode;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export const ResponsiveContext = createContext<ResponsiveContextType>({
  mode: 'desktop',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
});

export function useResponsiveContext() {
  return useContext(ResponsiveContext);
}
