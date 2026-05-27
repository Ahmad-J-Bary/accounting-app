export type SidebarDensity = 'compact' | 'comfortable' | 'spacious';
export type SidebarWidthPreset = 'narrow' | 'standard' | 'wide' | 'extra-wide';

export interface SidebarSettings {
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
