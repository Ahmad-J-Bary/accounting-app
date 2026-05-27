import { createContext } from 'react';
import { SidebarSettings } from '../types/sidebar-settings';

export interface SidebarSettingsContextType {
  settings: SidebarSettings;
  updateSetting: <K extends keyof SidebarSettings>(key: K, value: SidebarSettings[K]) => void;
  resetSettings: () => void;
  getFontSizeClass: () => string;
  getPaddingClass: () => string;
  getSpacingClass: () => string;
  getSidebarWidth: () => string;
}

export const SidebarSettingsContext = createContext<SidebarSettingsContextType | undefined>(undefined);
