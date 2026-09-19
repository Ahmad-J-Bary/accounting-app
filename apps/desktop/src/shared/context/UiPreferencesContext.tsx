import { createContext } from "react";
import type {
  DataHeaderSettings,
  PageHeaderSettings,
  PageTemplateSettings,
  UiPreferences,
} from "@shared/types/ui-preferences";
import type { AppearanceSettings } from "@shared/types/appearance";
import type { NavSidebarSettings, SidePanelSettings } from "@shared/types/sidebar-settings";
import type { TableSettings } from "@shared/types/table-settings";

export interface UiPreferencesContextType {
  preferences: UiPreferences;
  updateGeneralAppearance: (partial: Partial<AppearanceSettings>) => void;
  resetGeneralAppearance: () => void;
  updateTableAppearance: (partial: Partial<TableSettings>) => void;
  resetTableAppearance: () => void;
  updateSidebarAppearance: (partial: Partial<NavSidebarSettings>) => void;
  resetSidebarAppearance: () => void;
  updateOperationsPanel: (partial: Partial<SidePanelSettings>) => void;
  resetOperationsPanel: () => void;
  updatePageHeader: (partial: Partial<PageHeaderSettings>) => void;
  resetPageHeader: () => void;
  updateDataHeader: (partial: Partial<DataHeaderSettings>) => void;
  resetDataHeader: () => void;
  updatePageTemplate: (partial: Partial<PageTemplateSettings>) => void;
  resetPageTemplate: () => void;
  resetAll: () => void;
}

export const UiPreferencesContext = createContext<UiPreferencesContextType | undefined>(undefined);
