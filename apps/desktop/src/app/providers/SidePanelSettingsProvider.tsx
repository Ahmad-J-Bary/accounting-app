import React, { useEffect, ReactNode } from 'react';
import { SidePanelSettings, SidebarWidthPreset, SidebarDensity } from '@shared/types/sidebar-settings';
import { SidePanelSettingsContext } from '@shared/context/SidePanelSettingsContext';
import { useUiPreferences } from '@shared/hooks/useUiPreferences';

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

export const SidePanelSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { preferences, updateOperationsPanel, resetOperationsPanel } = useUiPreferences();
  const settings: SidePanelSettings = preferences.operationsPanel;

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

  const updateSetting = <K extends keyof SidePanelSettings>(key: K, value: SidePanelSettings[K]) => {
    const next: Partial<SidePanelSettings> = { [key]: value } as Partial<SidePanelSettings>;
    if (key === 'widthPreset') {
      next.customWidth = WIDTH_MAP[value as SidebarWidthPreset] ?? settings.customWidth;
    }
    updateOperationsPanel(next);
  };

  const resetSettings = () => resetOperationsPanel();

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
    <SidePanelSettingsContext.Provider value={{
      settings,
      updateSetting,
      resetSettings,
      getFontSizeClass,
      getPaddingClass,
      getSpacingClass,
      getSidebarWidth,
    }}>
      {children}
    </SidePanelSettingsContext.Provider>
  );
};
