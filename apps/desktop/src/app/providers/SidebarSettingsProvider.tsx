import React, { useState, useEffect, ReactNode } from 'react';
import { SidebarSettings, SidebarWidthPreset, SidebarDensity } from '@shared/types/sidebar-settings';
import { SidebarSettingsContext } from '@shared/context/SidebarSettingsContext';

const DEFAULT_SETTINGS: SidebarSettings = {
  widthPreset: 'standard',
  customWidth: 500,
  density: 'comfortable',
  fontSize: 13,
  paddingPreset: 'comfortable',
  spacingPreset: 'comfortable',
  background: 'bg-white',
  borderStyle: 'left',
  shadow: 'lg',
  stickyHeaderFooter: true,
  overlayVsInline: 'inline',
  animationSpeed: 300,
  closeButtonVisibility: true,
  saveButtonPlacement: 'right',
};

const WIDTH_MAP: Record<SidebarWidthPreset, number> = {
  narrow: 380,
  standard: 500,
  wide: 640,
  'extra-wide': 800,
};

const DENSITY_VARS: Record<SidebarDensity, Record<string, string>> = {
  compact: {
    "--sidebar-field-gap": "0.25rem",
    "--sidebar-section-gap": "0.75rem",
    "--sidebar-content-gap": "1rem",
    "--sidebar-container-py": "0.75rem",
    "--sidebar-container-px": "1rem",
    "--sidebar-label-size": "0.65rem",
    "--sidebar-field-py": "0.25rem",
  },
  comfortable: {
    "--sidebar-field-gap": "0.5rem",
    "--sidebar-section-gap": "1rem",
    "--sidebar-content-gap": "1.5rem",
    "--sidebar-container-py": "1rem",
    "--sidebar-container-px": "1.5rem",
    "--sidebar-label-size": "0.75rem",
    "--sidebar-field-py": "0.375rem",
  },
  spacious: {
    "--sidebar-field-gap": "0.75rem",
    "--sidebar-section-gap": "1.5rem",
    "--sidebar-content-gap": "2rem",
    "--sidebar-container-py": "1.25rem",
    "--sidebar-container-px": "2rem",
    "--sidebar-label-size": "0.8125rem",
    "--sidebar-field-py": "0.5rem",
  },
};

export const SidebarSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SidebarSettings>(() => {
    try {
      const saved = localStorage.getItem('erp_sidebar_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try { localStorage.setItem('erp_sidebar_settings', JSON.stringify(settings)); } catch { /* ignore storage errors */ }
  }, [settings]);

  useEffect(() => {
    const vars = DENSITY_VARS[settings.density];
    const root = document.documentElement;
    const body = document.body;
    
    // Update CSS variables
    Object.entries(vars).forEach(([key, val]) => root.style.setProperty(key, val));
    
    // Update body density class
    const densities: SidebarDensity[] = ['compact', 'comfortable', 'spacious'];
    densities.forEach(d => {
      const className = `sidebar-density-${d}`;
      if (d === settings.density) {
        body.classList.add(className);
      } else {
        body.classList.remove(className);
      }
    });
  }, [settings.density]);

  const updateSetting = <K extends keyof SidebarSettings>(key: K, value: SidebarSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'widthPreset') {
        next.customWidth = WIDTH_MAP[value as SidebarWidthPreset] ?? next.customWidth;
      }
      return next;
    });
  };

  const resetSettings = () => setSettings(DEFAULT_SETTINGS);

  const getFontSizeClass = () => {
    switch (settings.fontSize) {
      case 12: return 'text-xs';
      case 13: return 'text-[13px]';
      case 14: return 'text-sm';
      case 15: return 'text-[15px]';
      case 16: return 'text-base';
      default: return 'text-sm';
    }
  };

  const getPaddingClass = () => {
    switch (settings.paddingPreset) {
      case 'compact': return 'p-3';
      case 'spacious': return 'p-8';
      default: return 'p-6';
    }
  };

  const getSpacingClass = () => {
    switch (settings.spacingPreset) {
      case 'compact': return 'space-y-3';
      case 'spacious': return 'space-y-6';
      default: return 'space-y-4';
    }
  };

  const getSidebarWidth = () => `${settings.customWidth}px`;

  return (
    <SidebarSettingsContext.Provider value={{
      settings,
      updateSetting,
      resetSettings,
      getFontSizeClass,
      getPaddingClass,
      getSpacingClass,
      getSidebarWidth,
    }}>
      {children}
    </SidebarSettingsContext.Provider>
  );
};
