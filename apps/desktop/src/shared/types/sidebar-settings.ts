export type SidebarDensity = 'compact' | 'comfortable' | 'spacious';
export type SidebarWidthPreset = 'narrow' | 'standard' | 'wide' | 'extra-wide';
export type SidebarDensityPreset = 'compact' | 'comfortable' | 'spacious';
export type GroupCollapseBehavior = 'free' | 'accordion' | 'all-expanded';
export type GroupHeaderStyle = 'classic' | 'card' | 'line';

export type NavLayoutType =
  | 'vertical'
  | 'collapsed'
  | 'icon-only'
  | 'darknav'
  | 'topnav-slim';

export interface NavSidebarSettings {
  navLayoutType: NavLayoutType;
  navWidth: number;
  navCollapsed: boolean;
  navIconOnly: boolean;
  navFontSize: number;
  navDensity: SidebarDensityPreset;
  navShowLabels: boolean;
  navShowSectionHeaders: boolean;
  navActiveBg: string;
  navHoverBg: string;
  navBordered: boolean;
  navRemembersState: boolean;
  navAutoCollapse: boolean;
  navBackground: string;
  navGroupCollapseBehavior: GroupCollapseBehavior;
  navGroupHeaderStyle: GroupHeaderStyle;
}


export interface SidePanelSettings {
  widthPreset: SidebarWidthPreset;
  customWidth: number;
  density: SidebarDensity;
  fontSize: number;
  paddingPreset: 'compact' | 'comfortable' | 'spacious';
  spacingPreset: 'compact' | 'comfortable' | 'spacious';
  background: string;
  borderStyle: 'none' | 'left' | 'right' | 'all';
  shadow: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  stickyHeaderFooter: boolean;
  overlayVsInline: 'overlay' | 'inline';
  animationSpeed: number;
  closeButtonVisibility: boolean;
  saveButtonPlacement: 'left' | 'right' | 'justify';
}
