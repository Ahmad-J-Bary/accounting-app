import React, { ReactNode } from "react";
import { useSidebarSettings } from "@shared/hooks/useSidebarSettings";
import { cn } from "@shared/lib/utils";
import { Sheet, SheetContent } from "@shared/ui/sheet";
import type { SidebarShellProps } from "./types";

const WIDTH_MAP = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
} as const;

export function SidebarShell({
  children,
  className,
  width: widthProp,
  isOpen,
  onClose,
  forceOverlay,
}: SidebarShellProps) {
  const { settings, getSidebarWidth } = useSidebarSettings();
  const isOverlay =
    forceOverlay === true ||
    (forceOverlay === undefined && settings.overlayVsInline === "overlay");
  const show = isOpen ?? true;
  const handleClose = () => {
    if (onClose) onClose();
  };
  const widthClass = widthProp ? WIDTH_MAP[widthProp] : undefined;
  const width = getSidebarWidth();

  const shadowClass = {
    none: "shadow-none",
    sm: "shadow-sm",
    md: "shadow-md",
    lg: "shadow-lg",
    xl: "shadow-xl",
  }[settings.shadow];

  const borderClass = {
    none: "border-none",
    left: "border-l border-slate-200/70",
    right: "border-r border-slate-200/70",
    all: "border border-slate-200/70",
  }[settings.borderStyle];

  if (isOverlay) {
    return (
      <Sheet open={show} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent
          side="left"
          hideClose
          className={cn(
            "p-0 overflow-hidden flex flex-col h-full bg-white border-r border-slate-200/70 sm:max-w-none",
            settings.background,
            shadowClass,
            className
          )}
          style={{ width }}
        >
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full overflow-hidden transition-all shrink-0 bg-white rounded-xl",
        settings.background,
        borderClass,
        shadowClass,
        show ? "opacity-100" : "w-0 opacity-0 border-none p-0 overflow-hidden",
        widthClass,
        className
      )}
      style={{
        width: show ? width : "0px",
        transitionDuration: `${settings.animationSpeed}ms`,
      }}
      dir="rtl"
    >
      <div
        className="flex flex-col h-full overflow-hidden"
        style={{ minWidth: width }}
      >
        {children}
      </div>
    </aside>
  );
}
