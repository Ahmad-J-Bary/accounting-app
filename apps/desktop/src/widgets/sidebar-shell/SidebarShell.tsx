import { useSidePanelSettings } from "@shared/hooks";
import { cn } from "@shared/lib/utils";
import { Sheet, SheetContent } from "@shared/ui/sheet";
import { useLocalization } from "@app/providers/LocalizationProvider";
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
  const { settings, getSidebarWidth } = useSidePanelSettings();
  const { direction } = useLocalization();
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
    left: "border-s border-slate-200/70",
    right: "border-e border-slate-200/70",
    all: "border border-slate-200/70",
  }[settings.borderStyle];

  if (isOverlay) {
    return (
      <Sheet open={show} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent
          hideClose
          className={cn(
            "flex h-full flex-col overflow-hidden bg-white p-0 sm:max-w-none",
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
      dir={direction}
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
