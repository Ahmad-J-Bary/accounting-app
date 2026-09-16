import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { useSidePanelSettings } from "@shared/hooks";
import { useIsLaptop } from "@shared/hooks/useResponsive";

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
  const isLaptop = useIsLaptop();

  return (
    <aside
      className={cn(
        "bg-card rounded-xl border border-border shadow-xl flex flex-col overflow-hidden transition-all duration-300 shrink-0",
        !isOpen && "w-0 opacity-0 border-none p-0 overflow-hidden",
        isOpen && "max-lg:absolute max-lg:inset-y-0 max-lg:end-0 max-lg:z-30 max-lg:w-full sm:max-lg:w-[320px] md:max-lg:w-[380px] max-lg:shadow-2xl",
        className,
      )}
      style={{
        width: isOpen ? getSidebarWidth() : "0px",
        transitionProperty: "width, opacity",
      }}
    >
      <div
        className="flex-1 overflow-auto"
        style={{ minWidth: isLaptop ? undefined : settings.customWidth + "px" }}
      >
        {children}
      </div>
    </aside>
  );
}
