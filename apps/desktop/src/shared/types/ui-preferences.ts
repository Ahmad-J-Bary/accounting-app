import type { AppearanceSettings } from "@shared/types/appearance";
import type { NavSidebarSettings, SidePanelSettings } from "@shared/types/sidebar-settings";
import type { TableSettings } from "@shared/types/table-settings";
import { DEFAULT_APPEARANCE } from "@shared/types/appearance";

export type PageHeaderPreset = "compact" | "standard" | "spacious";
export type PageHeaderStyle = "standard" | "slim" | "wide" | "compact" | "elevated" | "flat";
export type PageHeaderHeight = "compact" | "standard" | "spacious";
export type PageHeaderSurface = "transparent" | "background" | "surface";
export type PageHeaderActionAlignment = "split" | "end";
export type PageHeaderBadgePlacement = "inline" | "stacked";

export interface PageHeaderSettings {
  preset: PageHeaderPreset;
  style: PageHeaderStyle;
  height: PageHeaderHeight;
  density: "compact" | "standard" | "spacious";
  surface: PageHeaderSurface;
  sticky: boolean;
  showBreadcrumbs: boolean;
  showSubtitle: boolean;
  compactButtons: boolean;
  actionAlignment: PageHeaderActionAlignment;
  badgePlacement: PageHeaderBadgePlacement;
}

export type DataHeaderPreset = "compact" | "standard" | "comfortable";
export type DataHeaderSurface = "flat" | "subtle" | "card";

export interface DataHeaderSettings {
  preset: DataHeaderPreset;
  density: "compact" | "standard" | "comfortable";
  surface: DataHeaderSurface;
  sticky: boolean;
}

export interface PageTemplateSettings {
  pageGutter: "compact" | "standard" | "comfortable";
  regionGap: "compact" | "standard" | "comfortable";
  tableShellRadius: "lg" | "xl";
}

export interface UiPreferences {
  version: 2;
  generalAppearance: AppearanceSettings;
  tableAppearance: TableSettings;
  sidebarAppearance: NavSidebarSettings;
  operationsPanel: SidePanelSettings;
  pageHeader: PageHeaderSettings;
  dataHeader: DataHeaderSettings;
  pageTemplate: PageTemplateSettings;
}

export const DEFAULT_TABLE_APPEARANCE: TableSettings = {
  density: "comfortable",
  fontSize: 13,
  fontFamily: "Inter, system-ui, sans-serif",
  rowHoverEffect: true,
  zebraRows: false,
  borderStyle: "horizontal",
  headerColor: "bg-slate-50/50",
  stickyHeader: true,
  showToolbar: true,
  showSummary: true,
  showPagination: true,
};

export const DEFAULT_SIDEBAR_APPEARANCE: NavSidebarSettings = {
  navLayoutType: "vertical",
  navWidth: 256,
  navCollapsed: false,
  navIconOnly: false,
  navFontSize: 13,
  navDensity: "comfortable",
  navShowLabels: true,
  navShowSectionHeaders: true,
  navActiveBg: "bg-blue-600",
  navHoverBg: "hover:bg-white/5 hover:text-white",
  navBordered: false,
  navRemembersState: true,
  navAutoCollapse: false,
  navBackground: "bg-slate-900",
  navGroupCollapseBehavior: "free",
  navGroupHeaderStyle: "classic",
};

export const DEFAULT_OPERATIONS_PANEL: SidePanelSettings = {
  widthPreset: "standard",
  customWidth: 500,
  density: "comfortable",
  fontSize: 13,
  paddingPreset: "comfortable",
  spacingPreset: "comfortable",
  background: "bg-white",
  borderStyle: "left",
  shadow: "lg",
  stickyHeaderFooter: true,
  overlayVsInline: "inline",
  animationSpeed: 300,
  closeButtonVisibility: true,
  saveButtonPlacement: "right",
};

export const DEFAULT_PAGE_HEADER_SETTINGS: PageHeaderSettings = {
  preset: "standard",
  style: "standard",
  height: "standard",
  density: "standard",
  surface: "background",
  sticky: true,
  showBreadcrumbs: true,
  showSubtitle: true,
  compactButtons: false,
  actionAlignment: "end",
  badgePlacement: "inline",
};

export const DEFAULT_DATA_HEADER_SETTINGS: DataHeaderSettings = {
  preset: "standard",
  density: "standard",
  surface: "subtle",
  sticky: false,
};

export const DEFAULT_PAGE_TEMPLATE_SETTINGS: PageTemplateSettings = {
  pageGutter: "compact",
  regionGap: "compact",
  tableShellRadius: "xl",
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  version: 2,
  generalAppearance: DEFAULT_APPEARANCE,
  tableAppearance: DEFAULT_TABLE_APPEARANCE,
  sidebarAppearance: DEFAULT_SIDEBAR_APPEARANCE,
  operationsPanel: DEFAULT_OPERATIONS_PANEL,
  pageHeader: DEFAULT_PAGE_HEADER_SETTINGS,
  dataHeader: DEFAULT_DATA_HEADER_SETTINGS,
  pageTemplate: DEFAULT_PAGE_TEMPLATE_SETTINGS,
};
