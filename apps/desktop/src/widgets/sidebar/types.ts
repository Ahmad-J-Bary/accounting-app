import type { ReactNode } from "react";

export type SidebarDensity = "compact" | "comfortable" | "spacious";
export type SidebarWidth = "sm" | "md" | "lg" | "xl";

export interface SidebarConfig {
  density: SidebarDensity;
  width: SidebarWidth;
}

export interface SidebarShellProps {
  children: ReactNode;
  className?: string;
  width?: SidebarWidth;
  isOpen?: boolean;
  onClose?: () => void;
  forceOverlay?: boolean;
}

export interface SidebarHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
}

export interface SidebarFooterProps {
  children?: ReactNode;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
}

export interface SidebarSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export interface FieldLabelProps {
  children: ReactNode;
  required?: boolean;
  className?: string;
}
