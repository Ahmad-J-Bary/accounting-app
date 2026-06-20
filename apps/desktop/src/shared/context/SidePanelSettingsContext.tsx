import { createContext } from 'react';
import { SidePanelSettings } from '../types/sidebar-settings';

export interface SidePanelSettingsContextType {
  settings: SidePanelSettings;
  updateSetting: <K extends keyof SidePanelSettings>(key: K, value: SidePanelSettings[K]) => void;
  resetSettings: () => void;
  getFontSizeClass: () => string;
  getPaddingClass: () => string;
  getSpacingClass: () => string;
  getSidebarWidth: () => string;
}

export const SidePanelSettingsContext = createContext<SidePanelSettingsContextType | undefined>(undefined);
