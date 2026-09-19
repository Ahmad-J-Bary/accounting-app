import { Building2 } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { WindowControls } from "./WindowControls";
import { WindowSurface } from "./WindowSurface";
import { useWindowChromeData } from "./useWindowChromeData";

interface StartupWindowShellProps {
  title: string;
  subtitle?: string;
  direction?: "rtl" | "ltr";
  children: React.ReactNode;
}

export function StartupWindowShell({
  title,
  subtitle,
  direction = "rtl",
  children,
}: StartupWindowShellProps) {
  const chrome = useWindowChromeData({
    windowTitle: title,
    brandLabelOverride: "المواكب",
    companyLabelOverride: subtitle || "نظام المحاسبة والمخزون",
  });

  const titleBar = (
    <div
      className={cn(
        "border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
        chrome.windowState.isFocused ? "shadow-sm" : "opacity-95",
      )}
      data-testid="startup-window-chrome"
    >
      <div
        className={cn(
          "grid grid-cols-[minmax(0,320px)_1fr_auto] items-center gap-3 px-3 py-2",
          chrome.windowState.isMaximized ? "pt-1" : "pt-2",
        )}
        dir="ltr"
      >
        <div
          data-tauri-drag-region={chrome.windowState.isTauriWindow ? true : undefined}
          onDoubleClick={chrome.handleTitleBarDoubleClick}
          className="flex min-w-0 items-center gap-3 select-none"
          dir={direction}
          title={title}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">{chrome.brandLabel}</div>
            <div className="truncate text-[11px] text-muted-foreground">{chrome.companyLabel}</div>
          </div>
        </div>

        <div
          data-tauri-drag-region={chrome.windowState.isTauriWindow ? true : undefined}
          onDoubleClick={chrome.handleTitleBarDoubleClick}
          className="min-w-0 select-none px-2 text-center"
          dir={direction}
        >
          <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        </div>

        <div className="flex justify-end">
          <WindowControls
            isMaximized={chrome.windowState.isMaximized || chrome.windowState.isFullscreen}
            disabled={!chrome.windowState.ready}
            variant="default"
            onMinimize={chrome.windowState.minimize}
            onToggleMaximize={chrome.windowState.toggleMaximize}
            onClose={chrome.windowState.close}
          />
        </div>
      </div>
    </div>
  );

  return (
    <WindowSurface
      chrome={titleBar}
      direction={direction}
      contentClassName="overflow-auto bg-gradient-to-br from-slate-50 via-white to-slate-100"
      testId="startup-window-surface"
    >
      {children}
    </WindowSurface>
  );
}
