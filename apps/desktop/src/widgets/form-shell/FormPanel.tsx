import { ReactNode } from "react";
import { SidebarShell } from "@widgets/sidebar/SidebarShell";
import { SidebarHeader } from "@widgets/sidebar/SidebarHeader";
import { SidebarFooter } from "@widgets/sidebar/SidebarFooter";
import type { SidebarWidth } from "@widgets/sidebar/types";

interface FormPanelProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  width?: SidebarWidth;
  saveLabel?: string;
  saveDisabled?: boolean;
}

export function FormPanel({
  title,
  icon,
  onClose,
  onSave,
  isSaving = false,
  children,
  footer,
  className,
  width,
  saveLabel = "حفظ البيانات",
  saveDisabled = false,
}: FormPanelProps) {
  return (
    <SidebarShell className={className} width={width} onClose={onClose}>
      <SidebarHeader title={title} icon={icon} onClose={onClose} />
      <div className="flex-1 overflow-y-auto"
        style={{
          padding: "var(--sidebar-container-py) var(--sidebar-container-px)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sidebar-content-gap)",
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
