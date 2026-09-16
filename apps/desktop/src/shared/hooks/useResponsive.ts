import { useState, useEffect, useCallback } from 'react';
import { breakpoints } from '@shared/config/designTokens';

export type ResponsiveMode = 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'wide';
export type LegacyResponsiveMode = 'mobile' | 'tablet' | 'desktop';

/**
 * 5-breakpoint responsive system aligned with DESIGN.md:
 * - mobile: <640px
 * - tablet: 640-1023px
 * - laptop: 1024-1279px
 * - desktop: 1280-1439px
 * - wide: ≥1440px
 */
const BREAKPOINT_VALUES = {
  mobile: 0,
  tablet: parseInt(breakpoints.sm),    // 640px
  laptop: parseInt(breakpoints.lg),    // 1024px
  desktop: parseInt(breakpoints.xl),   // 1280px
  wide: 1440,
} as const;

function getMode(): ResponsiveMode {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < BREAKPOINT_VALUES.tablet) return 'mobile';
  if (width < BREAKPOINT_VALUES.laptop) return 'tablet';
  if (width < BREAKPOINT_VALUES.desktop) return 'laptop';
  if (width < BREAKPOINT_VALUES.wide) return 'desktop';
  return 'wide';
}

/** Legacy 3-mode hook for backward compatibility */
function getLegacyMode(): LegacyResponsiveMode {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < parseInt(breakpoints.md)) return 'mobile';
  if (width < parseInt(breakpoints.lg)) return 'tablet';
  return 'desktop';
}

export function useResponsive(): ResponsiveMode {
  const [mode, setMode] = useState<ResponsiveMode>(getMode);

  useEffect(() => {
    const checkMode = () => setMode(getMode());
    window.addEventListener('resize', checkMode);
    return () => window.removeEventListener('resize', checkMode);
  }, []);

  return mode;
}

/** Legacy 3-mode hook (mobile/tablet/desktop) for backward compat */
export function useResponsiveLegacy(): LegacyResponsiveMode {
  const [mode, setMode] = useState<LegacyResponsiveMode>(getLegacyMode);

  useEffect(() => {
    const checkMode = () => setMode(getLegacyMode());
    window.addEventListener('resize', checkMode);
    return () => window.removeEventListener('resize', checkMode);
  }, []);

  return mode;
}

/** Convenience boolean selectors */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINT_VALUES.tablet - 1}px)`);
}

export function useIsTablet(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINT_VALUES.tablet}px) and (max-width: ${BREAKPOINT_VALUES.laptop - 1}px)`);
}

export function useIsLaptop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINT_VALUES.laptop}px) and (max-width: ${BREAKPOINT_VALUES.desktop - 1}px)`);
}

export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINT_VALUES.desktop}px)`);
}

export function useIsWide(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINT_VALUES.wide}px)`);
}

/** Returns the container width breakpoint based on a container element */
export function useContainerQuery(containerRef: React.RefObject<HTMLElement | null>): ResponsiveMode {
  const [mode, setMode] = useState<ResponsiveMode>('desktop');

  const handleResize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const width = el.clientWidth;
    if (width < BREAKPOINT_VALUES.tablet) setMode('mobile');
    else if (width < BREAKPOINT_VALUES.laptop) setMode('tablet');
    else if (width < BREAKPOINT_VALUES.desktop) setMode('laptop');
    else if (width < BREAKPOINT_VALUES.wide) setMode('desktop');
    else setMode('wide');
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    handleResize();

    const observer = new ResizeObserver(handleResize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, handleResize]);

  return mode;
}
