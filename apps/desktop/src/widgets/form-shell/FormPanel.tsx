import { ReactNode } from "react";
import { SidebarShell } from "@widgets/sidebar-shell/SidebarShell";
import { SidebarHeader } from "@widgets/sidebar-shell/SidebarHeader";
import { SidebarFooter } from "@widgets/sidebar-shell/SidebarFooter";
import type { SidebarWidth } from "@widgets/sidebar-shell/types";

interface FormPanelProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  width?: SidebarWidth;
  forceOverlay?: boolean;
  saveLabel?: string;
  saveDisabled?: boolean;
}

export function FormPanel({
  title,
  subtitle,
  icon,
  onClose,
  onSave,
  isSaving = false,
  children,
  footer,
  className,
  width,
  forceOverlay,
  saveLabel = "حفظ البيانات",
  saveDisabled = false,
}: FormPanelProps) {
  return (
    <SidebarShell className={className} width={width} onClose={onClose} forceOverlay={forceOverlay}>
      <SidebarHeader title={title} subtitle={subtitle} icon={icon} onClose={onClose} />
      <div className="flex-1 overflow-y-auto custom-scrollbar"
        style={{
          padding: "var(--sidebar-container-py) var(--sidebar-container-px)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sidebar-content-gap)",
          scrollBehavior: "smooth",
          overscrollBehavior: "contain",
        }}>
        {children}
      </div>
      <SidebarFooter
        onSave={onSave}
        onCancel={onClose}
        isSaving={isSaving}
        saveDisabled={saveDisabled}
        saveLabel={saveLabel}
      >
        {footer}
      </SidebarFooter>
    </SidebarShell>
  );
}
