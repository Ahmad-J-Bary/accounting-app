import type { ReactNode } from "react";

export type SidebarWidth = "sm" | "md" | "lg" | "xl";

export interface SidebarShellProps {
  isOpen?: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  forceOverlay?: boolean;
  width?: SidebarWidth;
}

export interface SidebarHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose?: () => void;
  actions?: ReactNode;
  className?: string;
}

export interface SidebarAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "success" | "danger" | "warning";
  disabled?: boolean;
  hidden?: boolean;
}

export interface SidebarActionBarProps {
  actions: SidebarAction[];
  className?: string;
  maxColumns?: 1 | 2 | 3;
}

export interface SidebarBodyProps {
  children: ReactNode;
  className?: string;
}

export interface SidebarDetailFieldProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export interface SidebarDetailGridProps {
  fields: SidebarDetailFieldProps[];
  columns?: 1 | 2;
  title?: string;
  icon?: ReactNode;
  className?: string;
}

export interface SidebarFooterProps {
  children?: ReactNode;
  onCancel?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  className?: string;
}

export interface SidebarSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export interface SidebarFieldGroupProps {
  children: ReactNode;
  columns?: 1 | 2;
  className?: string;
}

export interface SidebarEmptyStateProps {
  message?: string;
  icon?: ReactNode;
  className?: string;
}

export interface SidebarValidationSummaryProps {
  errors: string[];
  className?: string;
}

export interface FieldLabelProps {
  className?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}
