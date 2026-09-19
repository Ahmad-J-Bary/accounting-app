import { useMemo } from "react";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { useTabs } from "@app/providers/TabContext";
import { cn } from "@shared/lib/utils";
import { WindowControls } from "./WindowControls";
import { useWindowChromeData } from "./useWindowChromeData";
import { WindowDragRegion } from "./WindowDragRegion";
import { WindowChromeBrand } from "./WindowChromeBrand";

export function DefaultWindowChrome() {
  const { t, direction } = useLocalization();
  const { tabs, activeTabId } = useTabs();

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs.find((tab) => tab.active) ?? tabs[0],
    [activeTabId, tabs],
  );

  const appTitle = useMemo(() => {
    const brand = t("topbar.brandName", { namespace: "shell" });
    return activeTab ? `${activeTab.title} - ${brand}` : brand;
  }, [activeTab, t]);

  const chrome = useWindowChromeData({ windowTitle: appTitle });

  return (
    <div
      className={cn(
        "border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
        chrome.windowState.isFocused ? "shadow-sm" : "opacity-95",
      )}
      data-testid="default-window-chrome"
    >
      <div
        className={cn(
          "grid w-full min-w-0 grid-cols-[minmax(0,320px)_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2",
          chrome.windowState.isMaximized ? "pt-1" : "pt-2",
        )}
        dir="ltr"
      >
        <WindowDragRegion
          enabled={chrome.windowState.isTauriWindow}
          onDoubleClick={chrome.handleTitleBarDoubleClick}
          className="flex items-center"
          direction={direction}
          title={appTitle}
        >
          <WindowChromeBrand
            direction={direction}
            brandLabel={chrome.brandLabel}
            companyLabel={chrome.companyLabel}
          />
        </WindowDragRegion>

        <WindowDragRegion
          enabled={chrome.windowState.isTauriWindow}
          onDoubleClick={chrome.handleTitleBarDoubleClick}
          className="flex min-w-0 items-center justify-center px-2 text-center"
          direction={direction}
        >
          <div className="truncate text-sm font-semibold text-foreground">
            {activeTab?.title || t("dashboard", { namespace: "shell" })}
          </div>
        </WindowDragRegion>

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
}
