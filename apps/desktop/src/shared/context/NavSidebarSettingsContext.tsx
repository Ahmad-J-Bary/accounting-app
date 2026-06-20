import { createContext } from 'react';
import { NavSidebarSettings } from '../types/sidebar-settings';

export interface NavSidebarSettingsContextType {
  settings: NavSidebarSettings;
  updateSetting: <K extends keyof NavSidebarSettings>(key: K, value: NavSidebarSettings[K]) => void;
  resetSettings: () => void;
  getNavWidth: () => string;
  getNavFontSizeClass: () => string;
}

export const NavSidebarSettingsContext = createContext<NavSidebarSettingsContextType | undefined>(undefined);
