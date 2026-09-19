import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { UiPreferencesContext } from "@shared/context/UiPreferencesContext";
import type { AppearanceSettings } from "@shared/types/appearance";
import type { NavSidebarSettings, SidePanelSettings } from "@shared/types/sidebar-settings";
import type { TableSettings } from "@shared/types/table-settings";
import {
  DEFAULT_DATA_HEADER_SETTINGS,
  DEFAULT_OPERATIONS_PANEL,
  DEFAULT_PAGE_HEADER_SETTINGS,
  DEFAULT_PAGE_TEMPLATE_SETTINGS,
  DEFAULT_SIDEBAR_APPEARANCE,
  DEFAULT_TABLE_APPEARANCE,
  DEFAULT_UI_PREFERENCES,
  type DataHeaderSettings,
  type PageHeaderSettings,
  type PageTemplateSettings,
  type UiPreferences,
} from "@shared/types/ui-preferences";
import { DEFAULT_APPEARANCE } from "@shared/types/appearance";
import { deriveCompoundFromLayout } from "@shared/config/computeLayoutType";

const STORAGE_KEY = "erp_ui_preferences_v2";
type LegacyAppearanceSettings = Partial<AppearanceSettings>;

function migrateMotionMode(value: string | undefined): AppearanceSettings["motion"] {
  if (!value) return DEFAULT_APPEARANCE.motion;
  if (value === "full") return "standard";
  if (value === "reduced") return "light";
  if (value === "none" || value === "light" || value === "standard" || value === "high") {
    return value;
  }
  return DEFAULT_APPEARANCE.motion;
}

function parseStoredValue<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function migrateLegacyAppearance(value: LegacyAppearanceSettings | null): AppearanceSettings {
  if (!value) return DEFAULT_APPEARANCE;
  if (!("sidenavShape" in value)) {
    const compound = deriveCompoundFromLayout(value.layoutType || DEFAULT_APPEARANCE.layoutType);
    return {
      ...DEFAULT_APPEARANCE,
      ...value,
      motion: migrateMotionMode(value.motion),
      sidenavShape: compound.sidenavShape,
      topnavShape: compound.topnavShape,
      verticalNavbarAppearance: compound.verticalNavbarAppearance,
      horizontalNavbarAppearance: compound.horizontalNavbarAppearance,
      navMenuType: value.navMenuType || compound.navMenuType,
    };
  }
  return { ...DEFAULT_APPEARANCE, ...value, motion: migrateMotionMode(value.motion) };
}

function loadPreferences(): UiPreferences {
  if (typeof window === "undefined") return DEFAULT_UI_PREFERENCES;

  const stored = parseStoredValue<UiPreferences>(STORAGE_KEY);
  if (stored?.version === 2) {
    return {
      ...DEFAULT_UI_PREFERENCES,
      ...stored,
      generalAppearance: migrateLegacyAppearance(stored.generalAppearance),
      tableAppearance: { ...DEFAULT_TABLE_APPEARANCE, ...stored.tableAppearance },
      sidebarAppearance: { ...DEFAULT_SIDEBAR_APPEARANCE, ...stored.sidebarAppearance },
      operationsPanel: { ...DEFAULT_OPERATIONS_PANEL, ...stored.operationsPanel },
      pageHeader: { ...DEFAULT_PAGE_HEADER_SETTINGS, ...stored.pageHeader },
      dataHeader: { ...DEFAULT_DATA_HEADER_SETTINGS, ...stored.dataHeader },
      pageTemplate: { ...DEFAULT_PAGE_TEMPLATE_SETTINGS, ...stored.pageTemplate },
    };
  }

  return {
    version: 2,
    generalAppearance: migrateLegacyAppearance(parseStoredValue<LegacyAppearanceSettings>("erp_appearance_settings")),
    tableAppearance: { ...DEFAULT_TABLE_APPEARANCE, ...(parseStoredValue<TableSettings>("erp_table_settings") ?? {}) },
    sidebarAppearance: { ...DEFAULT_SIDEBAR_APPEARANCE, ...(parseStoredValue<NavSidebarSettings>("erp_nav_sidebar_settings") ?? {}) },
    operationsPanel: { ...DEFAULT_OPERATIONS_PANEL, ...(parseStoredValue<SidePanelSettings>("erp_side_panel_settings") ?? {}) },
    pageHeader: DEFAULT_PAGE_HEADER_SETTINGS,
    dataHeader: DEFAULT_DATA_HEADER_SETTINGS,
    pageTemplate: DEFAULT_PAGE_TEMPLATE_SETTINGS,
  };
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UiPreferences>(loadPreferences);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    window.localStorage.removeItem("erp_appearance_settings");
    window.localStorage.removeItem("erp_table_settings");
    window.localStorage.removeItem("erp_nav_sidebar_settings");
    window.localStorage.removeItem("erp_side_panel_settings");
  }, [preferences]);

  const updateGeneralAppearance = useCallback((partial: Partial<AppearanceSettings>) => {
    setPreferences((prev) => ({
      ...prev,
      generalAppearance: { ...prev.generalAppearance, ...partial },
    }));
  }, []);

  const resetGeneralAppearance = useCallback(() => {
    setPreferences((prev) => ({ ...prev, generalAppearance: DEFAULT_APPEARANCE }));
  }, []);

  const updateTableAppearance = useCallback((partial: Partial<TableSettings>) => {
    setPreferences((prev) => ({
      ...prev,
      tableAppearance: { ...prev.tableAppearance, ...partial },
    }));
  }, []);

  const resetTableAppearance = useCallback(() => {
    setPreferences((prev) => ({ ...prev, tableAppearance: DEFAULT_TABLE_APPEARANCE }));
  }, []);

  const updateSidebarAppearance = useCallback((partial: Partial<NavSidebarSettings>) => {
    setPreferences((prev) => ({
      ...prev,
      sidebarAppearance: { ...prev.sidebarAppearance, ...partial },
    }));
  }, []);

  const resetSidebarAppearance = useCallback(() => {
    setPreferences((prev) => ({ ...prev, sidebarAppearance: DEFAULT_SIDEBAR_APPEARANCE }));
  }, []);

  const updateOperationsPanel = useCallback((partial: Partial<SidePanelSettings>) => {
    setPreferences((prev) => ({
      ...prev,
      operationsPanel: { ...prev.operationsPanel, ...partial },
    }));
  }, []);

  const resetOperationsPanel = useCallback(() => {
    setPreferences((prev) => ({ ...prev, operationsPanel: DEFAULT_OPERATIONS_PANEL }));
  }, []);

  const updatePageHeader = useCallback((partial: Partial<PageHeaderSettings>) => {
    setPreferences((prev) => ({
      ...prev,
      pageHeader: { ...prev.pageHeader, ...partial },
    }));
  }, []);

  const resetPageHeader = useCallback(() => {
    setPreferences((prev) => ({ ...prev, pageHeader: DEFAULT_PAGE_HEADER_SETTINGS }));
  }, []);

  const updateDataHeader = useCallback((partial: Partial<DataHeaderSettings>) => {
    setPreferences((prev) => ({
      ...prev,
      dataHeader: { ...prev.dataHeader, ...partial },
    }));
  }, []);

  const resetDataHeader = useCallback(() => {
    setPreferences((prev) => ({ ...prev, dataHeader: DEFAULT_DATA_HEADER_SETTINGS }));
  }, []);

  const updatePageTemplate = useCallback((partial: Partial<PageTemplateSettings>) => {
    setPreferences((prev) => ({
      ...prev,
      pageTemplate: { ...prev.pageTemplate, ...partial },
    }));
  }, []);

  const resetPageTemplate = useCallback(() => {
    setPreferences((prev) => ({ ...prev, pageTemplate: DEFAULT_PAGE_TEMPLATE_SETTINGS }));
  }, []);

  const resetAll = useCallback(() => {
    setPreferences(DEFAULT_UI_PREFERENCES);
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      updateGeneralAppearance,
      resetGeneralAppearance,
      updateTableAppearance,
      resetTableAppearance,
      updateSidebarAppearance,
      resetSidebarAppearance,
      updateOperationsPanel,
      resetOperationsPanel,
      updatePageHeader,
      resetPageHeader,
      updateDataHeader,
      resetDataHeader,
      updatePageTemplate,
      resetPageTemplate,
      resetAll,
    }),
    [
      preferences,
      updateGeneralAppearance,
      resetGeneralAppearance,
      updateTableAppearance,
      resetTableAppearance,
      updateSidebarAppearance,
      resetSidebarAppearance,
      updateOperationsPanel,
      resetOperationsPanel,
      updatePageHeader,
      resetPageHeader,
      updateDataHeader,
      resetDataHeader,
      updatePageTemplate,
      resetPageTemplate,
      resetAll,
    ],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}
