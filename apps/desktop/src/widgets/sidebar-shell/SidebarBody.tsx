import { useSidePanelSettings } from "@shared/hooks/useSidePanelSettings";
import { cn } from "@shared/lib/utils";
import type { SidebarBodyProps } from "./types";

export function SidebarBody({ children, className }: SidebarBodyProps) {
  const { getPaddingClass, getSpacingClass, getFontSizeClass } =
    useSidePanelSettings();

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto custom-scrollbar text-right",
        getPaddingClass(),
        getSpacingClass(),
        getFontSizeClass(),
        className
      )}
    >
      {children}
    </div>
  );
}
