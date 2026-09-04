import { useState, useEffect } from 'react';
import { breakpoints } from '@shared/config/designTokens';

export type ResponsiveMode = 'mobile' | 'tablet' | 'desktop';

function getMode(): ResponsiveMode {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < parseInt(breakpoints.md)) {
    return 'mobile';
  } else if (width < parseInt(breakpoints.lg)) {
    return 'tablet';
  }
  return 'desktop';
}

export function useResponsive(): ResponsiveMode {
  const [mode, setMode] = useState<ResponsiveMode>(getMode);

  useEffect(() => {
    const checkMode = () => {
      setMode(getMode());
    };

    window.addEventListener('resize', checkMode);
    return () => window.removeEventListener('resize', checkMode);
  }, []);

  return mode;
}
