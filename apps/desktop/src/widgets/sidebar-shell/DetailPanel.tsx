import type { ReactNode } from "react";
import { SidebarShell } from "./SidebarShell";
import { SidebarHeader } from "./SidebarHeader";
import { cn } from "@shared/lib/utils";
import type { SidebarWidth } from "./types";

interface DetailPanelProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  width?: SidebarWidth;
}

export function DetailPanel({
  title,
  subtitle,
  icon,
  actions,
  onClose,
  children,
  className,
  width,
}: DetailPanelProps) {
  return (
    <SidebarShell onClose={onClose} width={width}>
      <SidebarHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        actions={actions}
        onClose={onClose}
      />
      <div
        className={cn("flex-1 overflow-y-auto", className)}
        style={{
          padding: "var(--sidebar-container-py) var(--sidebar-container-px)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sidebar-content-gap)",
        }}
      >
        {children}
      </div>
    </SidebarShell>
  );
}
