import React, { useEffect, useCallback, ReactNode } from 'react';
import { NavSidebarSettings, NavLayoutType } from '@shared/types/sidebar-settings';
import { NavSidebarSettingsContext } from '@shared/context/NavSidebarSettingsContext';
import { LAYOUT_PRESETS } from '@app/shell/sidebarConfig';
import { useUiPreferences } from '@shared/hooks/useUiPreferences';

const NAV_COLLAPSE_KEY = 'erp_nav_collapsed';

export const NavSidebarSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { preferences, updateSidebarAppearance, resetSidebarAppearance } = useUiPreferences();
  const settings: NavSidebarSettings = preferences.sidebarAppearance;

  useEffect(() => {
    if (!settings.navRemembersState) return;
    const savedCollapsed = localStorage.getItem(NAV_COLLAPSE_KEY);
    if (savedCollapsed === null) return;
    const nextCollapsed = savedCollapsed === 'true';
    if (nextCollapsed !== settings.navCollapsed) {
      updateSidebarAppearance({ navCollapsed: nextCollapsed });
    }
  }, [settings.navCollapsed, settings.navRemembersState, updateSidebarAppearance]);

  // ── Sync with global layout changes dispatched by AppearanceProvider ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { layoutType } = (e as CustomEvent<{ layoutType: NavLayoutType }>).detail;
      const preset = LAYOUT_PRESETS[layoutType];
      if (preset) {
        updateSidebarAppearance(preset);
      }
    };
    window.addEventListener('erp:layout-changed', handler);
    return () => window.removeEventListener('erp:layout-changed', handler);
  }, [updateSidebarAppearance]);

  const updateSetting = <K extends keyof NavSidebarSettings>(key: K, value: NavSidebarSettings[K]) => {
    const next: Partial<NavSidebarSettings> = { [key]: value } as Partial<NavSidebarSettings>;
    if (key === 'navLayoutType') {
      Object.assign(next, LAYOUT_PRESETS[value as NavLayoutType] ?? {});
    }
    if (key === 'navCollapsed' && settings.navRemembersState) {
      try {
        localStorage.setItem(NAV_COLLAPSE_KEY, String(value));
      } catch { /* ignore */ }
    }
    updateSidebarAppearance(next);
  };

  const resetSettings = () => resetSidebarAppearance();

  const getNavWidth = useCallback(() => {
    if (settings.navCollapsed) {
      return settings.navIconOnly ? '64px' : '72px';
    }
    return `${settings.navWidth}px`;
  }, [settings.navWidth, settings.navCollapsed, settings.navIconOnly]);

  const getNavFontSizeClass = useCallback(() => {
    switch (settings.navFontSize) {
      case 12: return 'text-xs';
      case 13: return 'text-[13px]';
      case 14: return 'text-sm';
      case 15: return 'text-[15px]';
      case 16: return 'text-base';
      default: return 'text-sm';
    }
  }, [settings.navFontSize]);

  return (
    <NavSidebarSettingsContext.Provider value={{
      settings,
      updateSetting,
      resetSettings,
      getNavWidth,
      getNavFontSizeClass,
    }}>
      {children}
    </NavSidebarSettingsContext.Provider>
  );
};
