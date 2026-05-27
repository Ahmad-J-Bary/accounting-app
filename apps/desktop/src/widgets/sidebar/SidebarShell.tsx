import { ReactNode } from 'react';
import { useSidebarSettings } from '@shared/hooks/useSidebarSettings';
import { cn } from '@shared/lib/utils';
import { Sheet, SheetContent } from '@shared/ui/sheet';
import type { SidebarShellProps, SidebarWidth } from "./types";

const WIDTH_MAP: Record<SidebarWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function SidebarShell({ children, className, width: widthProp, isOpen, onClose, forceOverlay }: SidebarShellProps) {
  const { settings, getSidebarWidth } = useSidebarSettings();
  const isOverlay = forceOverlay === true || (forceOverlay === undefined && settings.overlayVsInline === 'overlay');
  const show = isOpen ?? true;
  const handleClose = () => { if (onClose) onClose(); };
  const width = widthProp ? WIDTH_MAP[widthProp] : undefined;

  const shadowClass = {
    none: 'shadow-none',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  }[settings.shadow];

  const borderClass = {
    none: 'border-none',
    left: 'border-l border-slate-200/70',
    right: 'border-r border-slate-200/70',
    all: 'border border-slate-200/70',
  }[settings.borderStyle];

  if (isOverlay) {
    return (
      <Sheet open={show} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <SheetContent
          side="left"
          hideClose
          className={cn(
            "p-0 overflow-hidden flex flex-col h-full bg-white border-r border-slate-200/70 sm:max-w-none",
            settings.background,
            shadowClass,
            className
          )}
          style={{ width: getSidebarWidth() }}
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
        width,
        className
      )}
      style={{
        width: show ? getSidebarWidth() : '0px',
        transitionDuration: `${settings.animationSpeed}ms`
      }}
      dir="rtl"
    >
      <div
        className="flex flex-col h-full overflow-hidden"
        style={{ minWidth: settings.customWidth + 'px' }}
      >
        {children}
      </div>
    </aside>
  );
}
