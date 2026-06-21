// ── Layout Types ─────────────────────────────────────────────
export type LayoutType =
  | 'vertical'
  | 'topnav-slim'
  | 'navbar-horizontal'
  | 'horizontal-slim'
  | 'combo-nav';

// ── Compound Layout State ───────────────────────────────────
export type NavMenuType = 'sidenav' | 'topnav' | 'combo';
export type SidenavShape = 'default' | 'stacked';
export type TopnavShape = 'default' | 'slim' | 'stacked';
export type NavbarAppearance = 'light' | 'dark';

// ── Theme Types ──────────────────────────────────────────────
export type ThemeId =
  | 'default-light'
  | 'default-dark'
  | 'system'
  | 'luxury'
  | 'retro'
  | 'arctic'
  | 'nature'
  | 'ember'
  | 'dracula'
  | 'midnight';

export type ColorMode = 'light' | 'dark' | 'system';

// ── Density ──────────────────────────────────────────────────
export type DensityMode = 'compact' | 'comfortable' | 'spacious';

// ── Primary Color ────────────────────────────────────────────
export interface PrimaryColorPreset {
  id: string;
  name: string;
  nameAr: string;
  hue: number;
  saturation: number;
  lightness: number;
}

// ── Show/Hide toggles ───────────────────────────────────────
export interface VisibilitySettings {
  sidebar: boolean;
  topBar: boolean;
  tabs: boolean;
  search: boolean;
  notifications: boolean;
  breadcrumbs: boolean;
}

// ── Layout Config ────────────────────────────────────────────
export interface LayoutDefinition {
  id: LayoutType;
  name: string;
  nameAr: string;
  icon: string;
  description: string;
  /** Sidebar visibility: visible | collapsible | hidden | overlay */
  sidebarMode: 'visible' | 'collapsible' | 'hidden' | 'overlay';
  /** TopBar mode */
  topBarMode: 'visible' | 'hidden' | 'slim';
  /** Horizontal navbar mode */
  navbarMode: 'none' | 'full' | 'slim';
  /** Show multi-tab bar */
  showTabs: boolean;
  /** Allow group headers in sidebar */
  sidebarGroups: boolean;
  /** Default sidebar width */
  sidebarWidth: number;
  /** Shell component variant */
  shellVariant: 'vertical' | 'topnav' | 'horizontal' | 'combo';
}

// ── Theme Definition ─────────────────────────────────────────
export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  nameAr: string;
  icon: string;
  /** Base mode this theme targets */
  baseMode: 'light' | 'dark';
  /** CSS variable overrides (HSL values as strings: "h s% l%") */
  cssVariables: Record<string, string>;
  /** Whether this theme supports mode toggle (light/dark variant) */
  supportsMode: boolean;
}

// ── Complete Appearance Settings ─────────────────────────────
export interface AppearanceSettings {
  layoutType: LayoutType;
  theme: ThemeId;
  mode: ColorMode;
  primaryColor: string;
  density: DensityMode;
  show: VisibilitySettings;
  // Compound layout builder state
  navMenuType: NavMenuType;
  sidenavShape: SidenavShape;
  topnavShape: TopnavShape;
  verticalNavbarAppearance: NavbarAppearance;
  horizontalNavbarAppearance: NavbarAppearance;
  // Sidebar overrides
  sidebarWidth: number;
  sidebarBordered: boolean;
  sidebarCollapsed: boolean;
  sidebarGroups: boolean;
  sidebarIcons: boolean;
  sidebarLabels: boolean;
  sidebarCollapseBehavior: 'free' | 'accordion' | 'all-expanded';
  sidebarHeaderStyle: 'classic' | 'card' | 'line';
  sidebarActiveBg: string;
  sidebarHoverBg: string;
  sidebarFontSize: number;
  sidebarBackground: string;
}

// ── Defaults ─────────────────────────────────────────────────
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  layoutType: 'vertical',
  theme: 'default-light',
  mode: 'light',
  primaryColor: 'blue',
  density: 'comfortable',
  navMenuType: 'sidenav',
  sidenavShape: 'default',
  topnavShape: 'default',
  verticalNavbarAppearance: 'dark',
  horizontalNavbarAppearance: 'dark',
  show: {
    sidebar: true,
    topBar: true,
    tabs: true,
    search: true,
    notifications: true,
    breadcrumbs: true,
  },
  sidebarWidth: 256,
  sidebarBordered: true,
  sidebarCollapsed: false,
  sidebarGroups: true,
  sidebarIcons: true,
  sidebarLabels: true,
  sidebarCollapseBehavior: 'free',
  sidebarHeaderStyle: 'classic',
  sidebarActiveBg: 'bg-blue-600',
  sidebarHoverBg: 'hover:bg-white/5 hover:text-white',
  sidebarFontSize: 13,
  sidebarBackground: 'bg-slate-900',
};

// ── Context Type ─────────────────────────────────────────────
export interface AppearanceContextType {
  settings: AppearanceSettings;
  setLayoutType: (type: LayoutType) => void;
  setTheme: (theme: ThemeId) => void;
  setMode: (mode: ColorMode) => void;
  setPrimaryColor: (color: string) => void;
  setDensity: (density: DensityMode) => void;
  updateVisibility: (key: keyof VisibilitySettings, value: boolean) => void;
  updateSidebarSetting: <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => void;
  updateSettings: (partial: Partial<AppearanceSettings>) => void;
  resetSettings: () => void;
  // Resolved helpers
  activeTheme: ThemeDefinition;
  activeLayout: LayoutDefinition;
  isDark: boolean;
}
