import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { useSidePanelSettings } from "@shared/hooks";

interface TemplateDetailPanelProps {
  /** Whether the panel is currently open */
  isOpen: boolean;
  /** Panel content (details/form/sidebar shell) */
  children: ReactNode;
  /** Custom class */
  className?: string;
}

/**
 * Shared animated detail side panel used by page templates (tree + table).
 * Its width follows the global side-panel settings while the inner content
 * keeps a stable minimum width to avoid reflow while animating. When closed
 * it collapses to zero width and fades out.
 */
export function TemplateDetailPanel({
  isOpen,
  children,
  className,
}: TemplateDetailPanelProps) {
  const { getSidebarWidth, settings } = useSidePanelSettings();

  return (
    <aside
      className={cn(
        "bg-card rounded-xl border border-border shadow-xl flex flex-col overflow-hidden transition-all duration-300 shrink-0",
        !isOpen && "w-0 opacity-0 border-none p-0 overflow-hidden",
        className,
      )}
      style={{
        width: isOpen ? getSidebarWidth() : "0px",
        transitionProperty: "width, opacity",
      }}
    >
      <div className="flex-1 overflow-auto" style={{ minWidth: settings.customWidth + "px" }}>
        {children}
      </div>
    </aside>
  );
}