import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, Sparkles } from "lucide-react";
import { useTabs } from "@app/providers/TabContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { useGlobalSearch } from "@app/providers/useGlobalSearch";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useResponsiveContext } from "@shared/hooks/useResponsiveContext";
import { useAppearance } from "@shared/hooks/useAppearance";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { findRouteByPath, resolveGroupLabel, resolveRouteLabel, SYSTEM_ROUTE_GROUPS } from "./routeRegistry";
import { ICON_MAP } from "./sidebarConfig";
import { WindowControls } from "./WindowControls";
import { TabBar } from "./TabBar";
import { useCompanyTypeSettings, useCompanyInitState } from "@shared/hooks";
import { companyTypeOf, hiddenNavIds } from "@modules/opening-balance/lib/company-lifecycle";
import { WindowSurface } from "./WindowSurface";
import { useWindowChromeData } from "./useWindowChromeData";

interface VSCodeWorkspaceProps {
  content: React.ReactNode;
  isExchangeVisible: boolean;
  onToggleExchange: () => void;
}

function getItemIcon(iconName: string) {
  return ICON_MAP[iconName] ?? ICON_MAP.LayoutDashboard;
}

export function VSCodeWorkspace({
  content,
  isExchangeVisible,
  onToggleExchange,
}: VSCodeWorkspaceProps) {
  const { tabs, openTab, activeTabId } = useTabs();
  const { t, direction } = useLocalization();
  const { recent, openSearch, activateResult } = useGlobalSearch();
  const { hasMultipleCurrencies } = useCurrencyContext();
  const { isMobile, isTablet } = useResponsiveContext();
  const { settings } = useAppearance();
  const companySettings = useCompanyTypeSettings();
  const { initState, isReady } = useCompanyInitState();

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs.find((tab) => tab.active) ?? tabs[0],
    [activeTabId, tabs],
  );

  const hiddenItemIds = useMemo(
    () => hiddenNavIds(companyTypeOf(companySettings), isReady ? initState : "ACTIVE"),
    [companySettings, initState, isReady],
  );

  const visibleGroups = useMemo(
    () =>
      SYSTEM_ROUTE_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.isSeparator && item.to && !hiddenItemIds.has(item.id)),
      })).filter((group) => group.items.length > 0),
    [hiddenItemIds],
  );

  const activeRoute = activeTab ? findRouteByPath(activeTab.path) : undefined;
  const inferredActiveGroupId = activeRoute?.groupId ?? visibleGroups[0]?.id;
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(inferredActiveGroupId);
  const titleText = activeTab?.title || t("topbar.brandName", { namespace: "shell" });
  const chrome = useWindowChromeData({ windowTitle: titleText });

  useEffect(() => {
    if (inferredActiveGroupId) {
      setSelectedGroupId((prev) => prev ?? inferredActiveGroupId);
    }
  }, [inferredActiveGroupId]);

  const selectedGroup = visibleGroups.find((group) => group.id === (selectedGroupId || inferredActiveGroupId)) ?? visibleGroups[0];
  const companyText = chrome.companyLabel;
  const recents = recent.slice(0, 3);

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  const handleSidebarOpen = (route: { id: string; to: string }) => {
    openTab({
      id: `vscode-${route.id}`,
      title: resolveRouteLabel(route.id, t),
      path: route.to,
      closable: route.to !== "/dashboard",
      restoreKey: `route:${route.id}`,
      presentationMode: "vscode",
    });
  };

  if (!selectedGroup) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1f2430] text-white/70">
        {t("dashboard", { namespace: "shell" })}
      </div>
    );
  }

  const titleBar = (
    <div
      className={cn(
        "grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 bg-[#181c25] px-3",
        chrome.windowState.isFocused ? "shadow-sm" : "opacity-95",
      )}
      data-testid="vscode-titlebar"
    >
      <div
        data-tauri-drag-region={chrome.windowState.isTauriWindow ? true : undefined}
        onDoubleClick={chrome.handleTitleBarDoubleClick}
        className="flex min-w-0 items-center gap-3 select-none"
        dir={direction}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-white">{titleText}</div>
          <div className="truncate text-[10px] text-white/60">{companyText}</div>
        </div>
      </div>

      <div
        data-tauri-drag-region={chrome.windowState.isTauriWindow ? true : undefined}
        onDoubleClick={chrome.handleTitleBarDoubleClick}
        className="flex min-w-0 items-center justify-center px-2"
      >
        <button
          type="button"
          onClick={openSearch}
          className="flex h-8 w-full max-w-[34rem] items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-start text-xs text-white/70 transition-colors hover:bg-white/10"
          dir={direction}
          aria-label={t("globalSearch", { namespace: "shell" })}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-white/60" />
          <span className="truncate">
            {activeTab?.path || t("globalSearch", { namespace: "shell" })}
          </span>
          <span className="ms-auto shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">Ctrl+K</span>
        </button>
      </div>

      <div className="flex justify-end">
        <WindowControls
          isMaximized={chrome.windowState.isMaximized || chrome.windowState.isFullscreen}
          disabled={!chrome.windowState.ready}
          variant="vscode"
          onMinimize={chrome.windowState.minimize}
          onToggleMaximize={chrome.windowState.toggleMaximize}
          onClose={chrome.windowState.close}
        />
      </div>
    </div>
  );

  return (
    <WindowSurface
      chrome={titleBar}
      className="bg-[#1f2430] text-white"
      direction="ltr"
      testId="vscode-workbench"
    >
      <div className="min-h-0 flex flex-1 overflow-hidden">
        <aside className="flex w-12 shrink-0 flex-col items-center gap-2 border-e border-white/10 bg-[#181c25] py-3" data-testid="vscode-activitybar">
          {visibleGroups.map((group) => {
            const GroupIcon = getItemIcon(group.icon);
            const active = group.id === selectedGroup?.id;
            return (
              <Button
                key={group.id}
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleGroupSelect(group.id)}
                aria-label={resolveGroupLabel(group.id, t)}
                title={resolveGroupLabel(group.id, t)}
                className={cn(
                  "h-9 w-9 rounded-lg border border-transparent text-white/65 hover:bg-white/10 hover:text-white",
                  active && "bg-primary/20 text-primary hover:bg-primary/20 hover:text-primary",
                )}
              >
                <GroupIcon className="h-4 w-4" />
              </Button>
            );
          })}
        </aside>

        {!isMobile && (
          <aside
            className={cn(
              "flex shrink-0 flex-col overflow-hidden border-e border-white/10 bg-[#252b39]",
              isTablet ? "w-56" : "w-64",
            )}
            dir={direction}
            data-testid="vscode-sidebar"
          >
            <div className="border-b border-white/10 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.08em] text-white/45">
                {resolveGroupLabel(selectedGroup.id, t)}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-white">
                {selectedGroup.items.length} {t("appearance.preview.vscodeActivity", { namespace: "settings" })}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {selectedGroup.items.map((item) => {
                const ItemIcon = getItemIcon(item.icon);
                const isItemActive = activeRoute?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSidebarOpen(item)}
                    className={cn(
                      "mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors",
                      isItemActive
                        ? "bg-primary/18 text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <ItemIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{resolveRouteLabel(item.id, t)}</span>
                    <ChevronRight className="ms-auto h-3.5 w-3.5 text-white/40" />
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-white/10 bg-[#252b39] px-2 py-1" dir={direction} data-testid="vscode-editor-tabs">
            <TabBar />
          </div>

          <div
            className="min-h-0 flex flex-1 flex-col overflow-hidden bg-background text-foreground"
            data-testid="vscode-editor-content"
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              {content}
            </div>
          </div>

          <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-stretch border-t border-white/10 bg-[#252b39]" data-testid="vscode-panel">
            <div className="min-w-0 border-e border-white/10 px-3 py-2" dir={direction}>
              <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-white/45">
                {t("appearance.preview.vscodePanel", { namespace: "settings" })}
              </div>
              <div className="space-y-1">
                {recents.length > 0 ? recents.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => activateResult(item)}
                    className="block w-full truncate rounded-md px-2 py-1 text-start text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {item.title}
                  </button>
                )) : (
                  <div className="text-xs text-white/45">{t("search.recent", { namespace: "search" })}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 px-3 text-xs text-white/65" dir={direction}>
              <span className="truncate">{activeTab?.path || "/dashboard"}</span>
              <span className="rounded bg-white/10 px-2 py-1">{settings.motion}</span>
              {hasMultipleCurrencies && (
                <button
                  type="button"
                  onClick={onToggleExchange}
                  className={cn(
                    "rounded px-2 py-1 transition-colors",
                    isExchangeVisible ? "bg-primary/20 text-primary" : "bg-white/10 hover:bg-white/15",
                  )}
                >
                  FX
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="flex min-h-7 items-center justify-between gap-3 bg-[#007acc] px-3 text-[11px] text-white" dir={direction} data-testid="vscode-statusbar">
        <div className="truncate">{companyText}</div>
        <div className="flex items-center gap-3">
          <span>{settings.tabStyle.toUpperCase()}</span>
          <span>{settings.motion}</span>
        </div>
      </div>
    </WindowSurface>
  );
}
