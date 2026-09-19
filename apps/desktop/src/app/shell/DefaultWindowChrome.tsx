import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import type { CompanySettings } from "@erp/shared-types";
import { settingsService } from "@modules/core/api/settingsService";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { useTabs } from "@app/providers/TabContext";
import { cn } from "@shared/lib/utils";
import { WindowControls } from "./WindowControls";
import { useDesktopWindowState } from "./useDesktopWindowState";

export function DefaultWindowChrome() {
  const { t, direction } = useLocalization();
  const { tabs } = useTabs();
  const windowState = useDesktopWindowState();
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.active) ?? tabs[0],
    [tabs],
  );

  const appTitle = useMemo(() => {
    const brand = t("topbar.brandName", { namespace: "shell" });
    return activeTab ? `${activeTab.title} - ${brand}` : brand;
  }, [activeTab, t]);

  useEffect(() => {
    settingsService.getSettings().then(setCompanySettings).catch(() => {});
  }, []);

  useEffect(() => {
    void windowState.setWindowTitle(appTitle);
  }, [appTitle, windowState]);

  const handleTitleBarDoubleClick = () => {
    if (!windowState.isTauriWindow) return;
    void windowState.toggleMaximize();
  };

  return (
    <div
      className={cn(
        "border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
        windowState.isFocused ? "shadow-sm" : "opacity-95",
      )}
      data-testid="default-window-chrome"
    >
      <div
        className={cn(
          "grid grid-cols-[minmax(0,320px)_1fr_auto] items-center gap-3 px-3 py-2",
          windowState.isMaximized ? "pt-1" : "pt-2",
        )}
        dir="ltr"
      >
        <div
          data-tauri-drag-region={windowState.isTauriWindow ? true : undefined}
          onDoubleClick={handleTitleBarDoubleClick}
          className="flex min-w-0 items-center gap-3 select-none"
          dir={direction}
          title={appTitle}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">
              {t("topbar.brandName", { namespace: "shell" })}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {companySettings?.company_name || t("topbar.companyFallback", { namespace: "shell" })}
            </div>
          </div>
        </div>

        <div
          data-tauri-drag-region={windowState.isTauriWindow ? true : undefined}
          onDoubleClick={handleTitleBarDoubleClick}
          className="min-w-0 select-none px-2 text-center"
          dir={direction}
        >
          <div className="truncate text-sm font-semibold text-foreground">
            {activeTab?.title || t("dashboard", { namespace: "shell" })}
          </div>
        </div>

        <div className="flex justify-end">
          <WindowControls
            isMaximized={windowState.isMaximized || windowState.isFullscreen}
            disabled={!windowState.ready}
            variant="default"
            onMinimize={windowState.minimize}
            onToggleMaximize={windowState.toggleMaximize}
            onClose={windowState.close}
          />
        </div>
      </div>
    </div>
  );
}
