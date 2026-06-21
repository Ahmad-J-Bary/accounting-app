import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import type {
  AppearanceSettings,
  AppearanceContextType,
  LayoutType,
  ThemeId,
  ColorMode,
  DensityMode,
  VisibilitySettings,
} from '@shared/types/appearance';
import { DEFAULT_APPEARANCE } from '@shared/types/appearance';
import { getLayoutDefinition } from '@shared/config/layoutRegistry';
import { getThemeDefinition, THEME_REGISTRY } from '@shared/config/themeRegistry';
import { getPrimaryColor, applyPrimaryColor } from '@shared/config/primaryColors';
import { deriveCompoundFromLayout } from '@shared/config/computeLayoutType';

const STORAGE_KEY = 'erp_appearance_settings';

function loadSettings(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw);
    // Migration: legacy settings lack new compound fields — derive them from layoutType
    if (!('sidenavShape' in parsed)) {
      const compound = deriveCompoundFromLayout(parsed.layoutType || DEFAULT_APPEARANCE.layoutType);
      parsed.sidenavShape = compound.sidenavShape;
      parsed.topnavShape = compound.topnavShape;
      parsed.verticalNavbarAppearance = compound.verticalNavbarAppearance;
      parsed.horizontalNavbarAppearance = compound.horizontalNavbarAppearance;
      if (!parsed.navMenuType) {
        parsed.navMenuType = compound.navMenuType;
      }
    }
    return { ...DEFAULT_APPEARANCE, ...parsed };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function saveSettings(settings: AppearanceSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// eslint-disable-next-line react-refresh/only-export-components
export const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppearanceSettings>(loadSettings);

  // Persist on change
  useEffect(() => { saveSettings(settings); }, [settings]);

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
      setSettings(prev => ({ ...prev }));
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.mode]);

  // ── Setters ──
  const setLayoutType = useCallback((type: LayoutType) => {
    setSettings(prev => ({ ...prev, layoutType: type }));
  }, []);

  const setTheme = useCallback((theme: ThemeId) => {
    setSettings(prev => ({ ...prev, theme }));
  }, []);

  const setMode = useCallback((mode: ColorMode) => {
    setSettings(prev => ({ ...prev, mode }));
  }, []);

  const setPrimaryColor = useCallback((color: string) => {
    setSettings(prev => ({ ...prev, primaryColor: color }));
  }, []);

  const setDensity = useCallback((density: DensityMode) => {
    setSettings(prev => ({ ...prev, density }));
  }, []);

  const updateVisibility = useCallback((key: keyof VisibilitySettings, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      show: { ...prev.show, [key]: value },
    }));
  }, []);

  const updateSidebarSetting = useCallback(<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateSettings = useCallback((partial: Partial<AppearanceSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_APPEARANCE);
  }, []);

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
    updateVisibility,
    updateSidebarSetting,
    updateSettings,
    resetSettings,
  }), [
    settings, activeLayout, activeTheme, isDark,
    setLayoutType, setTheme, setMode, setPrimaryColor, setDensity,
    updateVisibility, updateSidebarSetting, updateSettings, resetSettings,
  ]);

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
};
