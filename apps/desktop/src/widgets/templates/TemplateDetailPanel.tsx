import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { useSidePanelSettings } from "@shared/hooks";
import { useIsMobile, useIsTablet, useIsLaptop } from "@shared/hooks/useResponsive";

interface TemplateDetailPanelProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
}

export function TemplateDetailPanel({
  isOpen,
  children,
  className,
}: TemplateDetailPanelProps) {
  const { getSidebarWidth, settings } = useSidePanelSettings();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isLaptop = useIsLaptop();
  const isOverlay = isMobile || isTablet;

  const resolvedWidth = isOverlay
    ? undefined
    : isOpen
    ? getSidebarWidth()
    : "0px";

  return (
    <aside
      className={cn(
        "bg-card rounded-xl border border-border shadow-xl flex flex-col overflow-hidden transition-all duration-300 shrink-0",
        !isOpen && "w-0 opacity-0 border-none p-0 overflow-hidden pointer-events-none",
        isOpen && isOverlay && "absolute inset-y-0 end-0 z-30 w-full sm:w-[380px] shadow-2xl",
        className,
      )}
      style={{
        width: resolvedWidth,
        transitionProperty: "width, opacity, transform",
      }}
    >
      <div
        className="flex-1 overflow-auto"
        style={{ minWidth: (isLaptop || isOverlay) ? undefined : settings.customWidth + "px" }}
      >
        {children}
      </div>
    </aside>
  );
}
