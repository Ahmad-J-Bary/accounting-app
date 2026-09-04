import { useState, useEffect } from 'react';
import { breakpoints } from '@shared/config/designTokens';

export type ResponsiveMode = 'mobile' | 'tablet' | 'desktop';

export function useResponsive(): ResponsiveMode {
  const [mode, setMode] = useState<ResponsiveMode>('desktop');

  useEffect(() => {
    const checkMode = () => {
      const width = window.innerWidth;
      if (width < parseInt(breakpoints.md)) {
        setMode('mobile');
      } else if (width < parseInt(breakpoints.lg)) {
        setMode('tablet');
      } else {
        setMode('desktop');
      }
    };

    checkMode();
    window.addEventListener('resize', checkMode);
    return () => window.removeEventListener('resize', checkMode);
  }, []);

  return mode;
}
