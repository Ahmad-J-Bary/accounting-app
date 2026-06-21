import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { NavSidebarSettings, NavLayoutType, SidebarDensityPreset } from '@shared/types/sidebar-settings';
import { NavSidebarSettingsContext } from '@shared/context/NavSidebarSettingsContext';
import { LAYOUT_PRESETS } from '@app/shell/sidebarConfig';

const NAV_COLLAPSE_KEY = 'erp_nav_collapsed';

const DEFAULT_SETTINGS: NavSidebarSettings = {
  navLayoutType: 'vertical' as NavLayoutType,
  navWidth: 256,
  navCollapsed: false,
  navIconOnly: false,
  navFontSize: 13,
  navDensity: 'comfortable' as SidebarDensityPreset,
  navShowLabels: true,
  navShowSectionHeaders: true,
  navActiveBg: 'bg-blue-600',
  navHoverBg: 'hover:bg-white/5 hover:text-white',
  navBordered: false,
  navRemembersState: true,
  navAutoCollapse: false,
  navBackground: 'bg-slate-900',
  navGroupCollapseBehavior: 'free',
  navGroupHeaderStyle: 'classic',
};

export const NavSidebarSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<NavSidebarSettings>(() => {
    try {
      const saved = localStorage.getItem('erp_nav_sidebar_settings');
      const loaded = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
      if (loaded.navRemembersState) {
        const savedCollapsed = localStorage.getItem(NAV_COLLAPSE_KEY);
        if (savedCollapsed !== null) {
          loaded.navCollapsed = savedCollapsed === 'true';
        }
      }
      return loaded;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('erp_nav_sidebar_settings', JSON.stringify(settings));
    } catch { /* ignore storage errors */ }
  }, [settings]);

  const updateSetting = <K extends keyof NavSidebarSettings>(key: K, value: NavSidebarSettings[K]) => {
    setSettings(prev => {
      let next = { ...prev, [key]: value };
      if (key === 'navLayoutType') {
        const preset = LAYOUT_PRESETS[value as NavLayoutType];
        if (preset) {
          next = { ...next, ...preset };
        }
      }
      if (key === 'navCollapsed' && prev.navRemembersState) {
        try {
          localStorage.setItem(NAV_COLLAPSE_KEY, String(value));
        } catch { /* ignore */ }
      }
      return next;
    });
  };

  const resetSettings = () => setSettings(DEFAULT_SETTINGS);

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
