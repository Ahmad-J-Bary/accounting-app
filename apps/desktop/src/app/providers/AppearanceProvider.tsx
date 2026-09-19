import React, { createContext, useEffect, useCallback, useMemo } from 'react';
import type {
  AppearanceContextType,
  LayoutType,
  ThemeId,
  ColorMode,
  DensityMode,
  UIScale,
  VisibilitySettings,
} from '@shared/types/appearance';
import type { AppearanceSettings } from '@shared/types/appearance';
import { getLayoutDefinition } from '@shared/config/layoutRegistry';
import { getThemeDefinition } from '@shared/config/themeRegistry';
import { getPrimaryColor, applyPrimaryColor } from '@shared/config/primaryColors';
import { useUiPreferences } from '@shared/hooks/useUiPreferences';

// eslint-disable-next-line react-refresh/only-export-components
export const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences, updateGeneralAppearance, resetGeneralAppearance } = useUiPreferences();
  const settings: AppearanceSettings = preferences.generalAppearance;

  // ── Resolve helpers ──
  const activeLayout = useMemo(() => getLayoutDefinition(settings.layoutType), [settings.layoutType]);
  const activeTheme = useMemo(() => getThemeDefinition(settings.theme), [settings.theme]);
  const isDark = useMemo(() => {
    if (settings.mode === 'dark') return true;
    if (settings.mode === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (settings.mode === 'light') return false;
    return activeTheme.baseMode === 'dark';
  }, [settings.mode, activeTheme.baseMode]);

  // ── Apply theme CSS variables on change ──
  useEffect(() => {
    const root = document.documentElement;

    root.setAttribute('data-theme', settings.theme);

    // Apply theme CSS variables
    const theme = activeTheme;
    Object.entries(theme.cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Apply dark/light mode
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Apply primary color override
    const primaryColor = getPrimaryColor(settings.primaryColor);
    if (primaryColor) {
      applyPrimaryColor(primaryColor.hue, primaryColor.saturation, primaryColor.lightness);
    }
  }, [settings.theme, settings.mode, settings.primaryColor, isDark, activeTheme]);

  // ── Apply density data attribute ──
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    // Legacy body class for backward-compat with sidebar density CSS
    body.classList.remove('sidebar-density-compact', 'sidebar-density-comfortable', 'sidebar-density-spacious');
    body.classList.add(`sidebar-density-${settings.density}`);
    // New data-attribute for CSS vars
    root.setAttribute('data-density', settings.density);
  }, [settings.density]);

  // ── Apply UI scale data attribute ──
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-scale', settings.uiScale);
  }, [settings.uiScale]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-tab-style', settings.tabStyle);
    root.setAttribute('data-motion', settings.motion);
  }, [settings.motion, settings.tabStyle]);

  // ── Apply layout data attribute + dispatch event for NavSidebarSettings sync ──
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-layout', settings.layoutType);
    // Notify NavSidebarSettingsProvider to apply layout preset
    window.dispatchEvent(new CustomEvent('erp:layout-changed', {
      detail: { layoutType: settings.layoutType },
    }));
  }, [settings.layoutType]);

  // ── Listen for system dark mode change ──
  useEffect(() => {
    if (settings.mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // Trigger re-render by reading isDark
      updateGeneralAppearance({});
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.mode, updateGeneralAppearance]);

  // ── Setters ──
  const setLayoutType = useCallback((type: LayoutType) => {
    updateGeneralAppearance({ layoutType: type });
  }, [updateGeneralAppearance]);

  const setTheme = useCallback((theme: ThemeId) => {
    updateGeneralAppearance({ theme });
  }, [updateGeneralAppearance]);

  const setMode = useCallback((mode: ColorMode) => {
    updateGeneralAppearance({ mode });
  }, [updateGeneralAppearance]);

  const setPrimaryColor = useCallback((color: string) => {
    updateGeneralAppearance({ primaryColor: color });
  }, [updateGeneralAppearance]);

  const setDensity = useCallback((density: DensityMode) => {
    updateGeneralAppearance({ density });
  }, [updateGeneralAppearance]);

  const setUIScale = useCallback((uiScale: UIScale) => {
    updateGeneralAppearance({ uiScale });
  }, [updateGeneralAppearance]);

  const updateVisibility = useCallback((key: keyof VisibilitySettings, value: boolean) => {
    updateGeneralAppearance({
      show: { ...settings.show, [key]: value },
    });
  }, [settings.show, updateGeneralAppearance]);

  const updateSidebarSetting = useCallback(<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
    updateGeneralAppearance({ [key]: value } as Partial<AppearanceSettings>);
  }, [updateGeneralAppearance]);

  const updateSettings = useCallback((partial: Partial<AppearanceSettings>) => {
    updateGeneralAppearance(partial);
  }, [updateGeneralAppearance]);

  const resetSettings = useCallback(() => {
    resetGeneralAppearance();
  }, [resetGeneralAppearance]);

  // ── Context value ──
  const value = useMemo<AppearanceContextType>(() => ({
    settings,
    activeLayout,
    activeTheme,
    isDark,
    setLayoutType,
    setTheme,
    setMode,
    setPrimaryColor,
    setDensity,
    setUIScale,
    updateVisibility,
    updateSidebarSetting,
    updateSettings,
    resetSettings,
  }), [
    settings, activeLayout, activeTheme, isDark,
    setLayoutType, setTheme, setMode, setPrimaryColor, setDensity, setUIScale,
    updateVisibility, updateSidebarSetting, updateSettings, resetSettings,
  ]);

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
};
