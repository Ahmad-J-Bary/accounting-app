import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, Building2, ChevronDown, Clock3, DollarSign, Mic, RefreshCw, Search, Settings as SettingsIcon, Star, Zap } from "lucide-react";
import type { CompanySettings } from "@erp/shared-types";
import type { GlobalSearchResult } from "@shared/types/navigation";
import { useAppearance } from "@shared/hooks/useAppearance";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@shared/ui/avatar";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useGlobalSearch } from "@app/providers/useGlobalSearch";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { useTabs } from "@app/providers/TabContext";
import { useVoice } from "@app/providers/VoiceProvider";
import { useCommands } from "@app/providers/useCommands";
import { settingsService } from "@modules/core/api/settingsService";
import { NotificationsPanel } from "./NotificationsPanel";
import { TabBar } from "./TabBar";
import { WindowControls } from "./WindowControls";
import { useDesktopWindowState } from "./useDesktopWindowState";

interface BrowserChromeProps {
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

interface BrowserFavorite {
  path: string;
  title: string;
  icon?: string;
}

const BROWSER_FAVORITES_KEY = "erp.browser.favorites.v1";

function loadBrowserFavorites(): BrowserFavorite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BROWSER_FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as BrowserFavorite[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface ShellChromeModel {
  direction: "rtl" | "ltr";
  settings: ReturnType<typeof useAppearance>["settings"];
  showTabs: boolean;
  isBrowserTabs: boolean;
  showDetachedTabs: boolean;
  appTitle: string;
  activeTabTitle: string;
  activeTabDirty: boolean;
  companyLabel: string;
  hasMultipleCurrencies: boolean;
  isExchangeVisible?: boolean;
  notificationsOpen: boolean;
  language: string;
  activePath: string;
  favorites: BrowserFavorite[];
  recentResults: GlobalSearchResult[];
  isFavorite: boolean;
  iconButtonClassName: string;
  utilityGapClassName: string;
  windowState: ReturnType<typeof useDesktopWindowState>;
  t: ReturnType<typeof useLocalization>["t"];
  openSearch: () => void;
  goBack: () => void;
  goForward: () => void;
  refreshCurrentView: () => void;
  toggleFavorite: () => void;
  activateRecent: (result: GlobalSearchResult) => void;
  activateFavorite: (favorite: BrowserFavorite) => void;
  onToggleExchange?: () => void;
  openVoice: () => void;
  openNotifications: () => void;
  closeNotifications: () => void;
  openSettingsTab: () => void;
  toggleLanguage: () => void;
  handleTitleBarDoubleClick: () => void;
  renderQuickActions: (compact: boolean) => JSX.Element;
}

function useShellChromeModel({
  isExchangeVisible,
  onToggleExchange,
}: BrowserChromeProps): ShellChromeModel {
  const { settings, activeLayout } = useAppearance();
  const { hasMultipleCurrencies } = useCurrencyContext();
  const { openSearch, recent, activateResult } = useGlobalSearch();
  const { language, setLanguage, t, direction } = useLocalization();
  const { tabs, openTab, switchTab } = useTabs();
  const voice = useVoice();
  const { executeCommand } = useCommands();
  const windowState = useDesktopWindowState();
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [favorites, setFavorites] = useState<BrowserFavorite[]>(loadBrowserFavorites);

  const showTabs = settings.show.tabs && activeLayout.showTabs;
  const isBrowserTabs = showTabs && settings.tabStyle === "browser";
  const showDetachedTabs = showTabs && settings.tabStyle !== "browser";

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
    window.localStorage.setItem(BROWSER_FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    void windowState.setWindowTitle(appTitle);
  }, [appTitle, windowState]);

  const createEntityTab = useCallback((idPrefix: string, titleKey: string, path: string, eventName: string) => {
    openTab({
      id: `${idPrefix}-${Date.now()}`,
      title: t(titleKey, { namespace: "shell" }),
      path,
      closable: true,
    });
    window.dispatchEvent(new CustomEvent(eventName));
  }, [openTab, t]);

  const openSettingsTab = useCallback(() => {
    openTab({
      id: "/settings",
      title: t("topbar.settings", { namespace: "shell" }),
      path: "/settings",
      closable: true,
    });
  }, [openTab, t]);

  const handleTitleBarDoubleClick = useCallback(() => {
    if (!windowState.isTauriWindow) return;
    void windowState.toggleMaximize();
  }, [windowState]);

  const activePath = activeTab?.path || "/dashboard";
  const isFavorite = favorites.some((favorite) => favorite.path === activePath);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  const goForward = useCallback(() => {
    window.history.forward();
  }, []);

  const refreshCurrentView = useCallback(() => {
    window.location.reload();
  }, []);

  const toggleFavorite = useCallback(() => {
    if (!activeTab) return;
    setFavorites((prev) => {
      const exists = prev.some((favorite) => favorite.path === activeTab.path);
      if (exists) {
        return prev.filter((favorite) => favorite.path !== activeTab.path);
      }
      return [{ path: activeTab.path, title: activeTab.title, icon: activeTab.icon }, ...prev].slice(0, 10);
    });
  }, [activeTab]);

  const activateFavorite = useCallback((favorite: BrowserFavorite) => {
    const existing = tabs.find((tab) => tab.path === favorite.path);
    if (existing) {
      switchTab(existing.id);
      return;
    }
    openTab({
      id: `favorite:${favorite.path}`,
      title: favorite.title,
      path: favorite.path,
      icon: favorite.icon,
      presentationMode: "browser",
    });
  }, [openTab, switchTab, tabs]);

  const iconButtonClassName = isBrowserTabs
    ? "h-10 w-10 rounded-xl border border-border/50 bg-background/75 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground"
    : "h-9 w-9 rounded-lg";

  const utilityGapClassName = isBrowserTabs ? "gap-1.5" : "gap-1.5";

  const renderQuickActions = useCallback((compact: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="icon"
            className={iconButtonClassName}
            aria-label={t("topbar.quickAction", { namespace: "shell" })}
            title={t("topbar.quickAction", { namespace: "shell" })}
          >
            <Zap className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-border/70 px-3">
            <Zap className="h-4 w-4" />
            <span className="hidden xl:inline">{t("topbar.quickAction", { namespace: "shell" })}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => executeCommand("new-sales-invoice")}>
          {t("topbar.newSalesInvoice", { namespace: "shell" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => executeCommand("new-purchase-invoice")}>
          {t("topbar.newPurchaseInvoice", { namespace: "shell" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => executeCommand("new-journal-entry")}>
          {t("topbar.newJournalEntry", { namespace: "shell" })}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => createEntityTab("/customers/new", "topbar.newCustomer", "/customers", "erp:open-new-customer")}>
          {t("topbar.newCustomer", { namespace: "shell" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => createEntityTab("/suppliers/new", "topbar.newSupplier", "/suppliers", "erp:open-new-supplier")}>
          {t("topbar.newSupplier", { namespace: "shell" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => createEntityTab("/materials/new", "topbar.newProduct", "/materials", "erp:open-new-product")}>
          {t("topbar.newProduct", { namespace: "shell" })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ), [createEntityTab, executeCommand, iconButtonClassName, t]);

  return {
    direction,
    settings,
    showTabs,
    isBrowserTabs,
    showDetachedTabs,
    appTitle,
    activeTabTitle: activeTab?.title || appTitle,
    activeTabDirty: Boolean(activeTab?.dirty),
    activePath,
    companyLabel: companySettings?.company_name || t("topbar.companyFallback", { namespace: "shell" }),
    hasMultipleCurrencies,
    isExchangeVisible,
    notificationsOpen,
    language,
    favorites,
    recentResults: recent,
    isFavorite,
    iconButtonClassName,
    utilityGapClassName,
    windowState,
    t,
    openSearch,
    goBack,
    goForward,
    refreshCurrentView,
    toggleFavorite,
    activateRecent: activateResult,
    activateFavorite,
    onToggleExchange,
    openVoice: voice.open,
    openNotifications: () => setNotificationsOpen(true),
    closeNotifications: () => setNotificationsOpen(false),
    openSettingsTab,
    toggleLanguage: () => setLanguage(language === "ar" ? "en" : "ar"),
    handleTitleBarDoubleClick,
    renderQuickActions,
  };
}

function ChromeIdentity({
  compact,
  direction,
  brandLabel,
  companyLabel,
  appTitle,
  isTauriWindow,
  onDoubleClick,
}: {
  compact: boolean;
  direction: "rtl" | "ltr";
  brandLabel: string;
  companyLabel: string;
  appTitle: string;
  isTauriWindow: boolean;
  onDoubleClick: () => void;
}) {
  return (
    <div
      data-tauri-drag-region={isTauriWindow ? true : undefined}
      onDoubleClick={onDoubleClick}
      className={cn(
        "flex min-w-0 items-center select-none",
        compact
          ? "h-12 gap-3 rounded-t-2xl border border-border/60 bg-background/80 px-3 shadow-sm"
          : "gap-3",
      )}
      dir={direction}
      title={appTitle}
    >
      <div className={cn(
        "flex items-center justify-center bg-primary text-primary-foreground shadow-sm",
        compact ? "h-8 w-8 rounded-xl" : "h-8 w-8 rounded-xl",
      )}>
        <Building2 className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className={cn("truncate font-bold text-foreground", compact ? "text-[13px]" : "text-sm")}>
          {brandLabel}
        </div>
        <div className={cn("truncate text-muted-foreground", compact ? "text-[11px]" : "text-[11px]")}>
          {companyLabel}
        </div>
      </div>
    </div>
  );
}

function BrowserToolbar({ model }: { model: ShellChromeModel }) {
  const {
    direction,
    activePath,
    isFavorite,
    favorites,
    recentResults,
    iconButtonClassName,
    t,
    openSearch,
    goBack,
    goForward,
    refreshCurrentView,
    toggleFavorite,
    activateRecent,
    activateFavorite,
  } = model;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-border/50 px-3 py-2" dir="ltr">
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goBack}
          aria-label={t("workspace.controls.scrollBackward", { namespace: "shell" })}
          className={iconButtonClassName}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goForward}
          aria-label={t("workspace.controls.scrollForward", { namespace: "shell" })}
          className={iconButtonClassName}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={refreshCurrentView}
          aria-label={t("common.actions.refresh", { namespace: "common" })}
          className={iconButtonClassName}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <button
        type="button"
        onClick={openSearch}
        className="flex h-11 min-w-0 items-center gap-2 rounded-full border border-border/60 bg-background px-4 text-start shadow-sm transition-colors hover:bg-card"
        dir={direction}
        aria-label={t("globalSearch", { namespace: "shell" })}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{activePath}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {t("appearance.preview.browserToolbar", { namespace: "settings" })}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">Ctrl+K</span>
      </button>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleFavorite}
          aria-label={isFavorite ? t("topbar.removeFavorite", { namespace: "shell" }) : t("topbar.addFavorite", { namespace: "shell" })}
          className={cn(iconButtonClassName, isFavorite && "text-warning")}
        >
          <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className={iconButtonClassName} aria-label={t("topbar.favorites", { namespace: "shell" })}>
              <Clock3 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div dir={direction}>
              <DropdownMenuLabel>{t("search.recent", { namespace: "search" })}</DropdownMenuLabel>
              {recentResults.slice(0, 5).map((result) => (
                <DropdownMenuItem key={result.id} onClick={() => activateRecent(result)}>
                  {result.title}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("topbar.favorites", { namespace: "shell" })}</DropdownMenuLabel>
              {favorites.length > 0 ? favorites.map((favorite) => (
                <DropdownMenuItem key={favorite.path} onClick={() => activateFavorite(favorite)}>
                  {favorite.title}
                </DropdownMenuItem>
              )) : (
                <DropdownMenuItem disabled>{t("topbar.noFavorites", { namespace: "shell" })}</DropdownMenuItem>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <ChromeUtilityActions compact model={model} includeSearchButton={false} />
      </div>
    </div>
  );
}

function ChromeUserMenu({
  compact,
  direction,
  language,
  t,
  openSettingsTab,
  toggleLanguage,
}: {
  compact: boolean;
  direction: "rtl" | "ltr";
  language: string;
  t: ShellChromeModel["t"];
  openSettingsTab: () => void;
  toggleLanguage: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 text-sm transition",
            compact
              ? "h-10 rounded-xl border border-border/50 bg-background/75 px-2.5 shadow-sm hover:bg-background"
              : "h-9 rounded-lg border border-border/70 bg-background px-2.5 hover:bg-accent",
          )}
          dir={direction}
        >
          <Avatar className={compact ? "h-7 w-7" : "h-7 w-7"}>
            <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">أ</AvatarFallback>
          </Avatar>
          <span className={cn("text-start", compact ? "hidden xl:block" : "hidden lg:block")}>
            <span className="block text-[11px] font-semibold leading-tight">{t("topbar.user", { namespace: "shell" })}</span>
          </span>
          <ChevronDown className={cn("text-muted-foreground", compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("topbar.account", { namespace: "shell" })}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openSettingsTab}>
          <SettingsIcon className="me-2 h-4 w-4" />
          {t("topbar.settings", { namespace: "shell" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleLanguage}>
          <SettingsIcon className="me-2 h-4 w-4" />
          {language === "ar"
            ? t("topbar.switchToEnglish", { namespace: "shell" })
            : t("topbar.switchToArabic", { namespace: "shell" })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChromeUtilityActions({
  compact,
  model,
  includeSearchButton = true,
}: {
  compact: boolean;
  model: ShellChromeModel;
  includeSearchButton?: boolean;
}) {
  const {
    settings,
    hasMultipleCurrencies,
    isExchangeVisible,
    iconButtonClassName,
    utilityGapClassName,
    t,
    openSearch,
    onToggleExchange,
    openVoice,
    openNotifications,
    openSettingsTab,
    toggleLanguage,
    renderQuickActions,
    direction,
    language,
  } = model;

  return (
    <div className={cn("flex shrink-0 items-center", utilityGapClassName)} dir="ltr">
      {includeSearchButton && settings.show.search && (
        <Button
          variant="ghost"
          size="icon"
          onClick={openSearch}
          aria-label={t("globalSearch", { namespace: "shell" })}
          title={t("globalSearch", { namespace: "shell" })}
          className={cn(compact ? "hidden lg:inline-flex" : "hidden lg:inline-flex", iconButtonClassName)}
        >
          <Search className="h-4 w-4" />
        </Button>
      )}

      {hasMultipleCurrencies && (
        <Button
          variant={isExchangeVisible ? "secondary" : "ghost"}
          size="icon"
          onClick={onToggleExchange}
          aria-label={isExchangeVisible ? t("topbar.hideExchangeRate", { namespace: "shell" }) : t("topbar.showExchangeRate", { namespace: "shell" })}
          title={isExchangeVisible ? t("topbar.hideExchangeRate", { namespace: "shell" }) : t("topbar.showExchangeRate", { namespace: "shell" })}
          className={cn(compact ? "hidden lg:inline-flex" : "hidden lg:inline-flex", iconButtonClassName)}
        >
          <DollarSign className="h-4 w-4" />
        </Button>
      )}

      {renderQuickActions(compact)}

      <Button
        variant="ghost"
        size="icon"
        onClick={openVoice}
        aria-label={t("voice", { namespace: "shell" })}
        title={t("voice", { namespace: "shell" })}
        className={cn(compact ? "hidden md:inline-flex" : "hidden sm:inline-flex", iconButtonClassName)}
      >
        <Mic className="h-4 w-4" />
      </Button>

      {settings.show.notifications && (
        <Button
          variant="ghost"
          size="icon"
          onClick={openNotifications}
          aria-label={t("notifications", { namespace: "shell" })}
          title={t("notifications", { namespace: "shell" })}
          className={cn("relative", iconButtonClassName)}
        >
          <Bell className="h-4 w-4" />
          <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-destructive" />
        </Button>
      )}

      <ChromeUserMenu
        compact={compact}
        direction={direction}
        language={language}
        t={t}
        openSettingsTab={openSettingsTab}
        toggleLanguage={toggleLanguage}
      />
    </div>
  );
}

function BrowserTitleBar({ model }: { model: ShellChromeModel }) {
  const { direction, appTitle, companyLabel, windowState, t, handleTitleBarDoubleClick } = model;

  return (
    <div
      className={cn(
        "border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
        windowState.isFocused ? "shadow-sm" : "opacity-95",
      )}
      data-testid="browser-window-chrome"
    >
      <div
        className={cn(
          "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 px-3 pb-0",
          windowState.isMaximized ? "pt-1" : "pt-2",
        )}
        dir="ltr"
      >
        <ChromeIdentity
          compact
          direction={direction}
          brandLabel={t("topbar.brandName", { namespace: "shell" })}
          companyLabel={companyLabel}
          appTitle={appTitle}
          isTauriWindow={windowState.isTauriWindow}
          onDoubleClick={handleTitleBarDoubleClick}
        />

        <div className="flex min-w-0 items-end gap-2" data-testid="browser-titlebar-tabs">
          <div
            data-tauri-drag-region={windowState.isTauriWindow ? true : undefined}
            onDoubleClick={handleTitleBarDoubleClick}
            className="hidden h-12 min-w-5 xl:block"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1" dir={direction}>
            <TabBar />
          </div>
          <div
            data-tauri-drag-region={windowState.isTauriWindow ? true : undefined}
            onDoubleClick={handleTitleBarDoubleClick}
            className="hidden h-12 min-w-5 2xl:block"
            aria-hidden="true"
          />
        </div>

        <div className="flex items-end justify-end">
          <WindowControls
            isMaximized={windowState.isMaximized || windowState.isFullscreen}
            disabled={!windowState.ready}
            variant="browser"
            onMinimize={windowState.minimize}
            onToggleMaximize={windowState.toggleMaximize}
            onClose={windowState.close}
          />
        </div>
      </div>
      <BrowserToolbar model={model} />
    </div>
  );
}

function DefaultTitleBar({ model }: { model: ShellChromeModel }) {
  const {
    direction,
    appTitle,
    activeTabTitle,
    activeTabDirty,
    companyLabel,
    windowState,
    showDetachedTabs,
    t,
    handleTitleBarDoubleClick,
  } = model;

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
          "grid grid-cols-[minmax(0,280px)_1fr_auto_auto] items-center gap-3 border-b border-border/70 px-3 py-2",
          windowState.isMaximized ? "pt-1" : "pt-2",
        )}
        dir="ltr"
      >
        <ChromeIdentity
          compact={false}
          direction={direction}
          brandLabel={t("topbar.brandName", { namespace: "shell" })}
          companyLabel={companyLabel}
          appTitle={appTitle}
          isTauriWindow={windowState.isTauriWindow}
          onDoubleClick={handleTitleBarDoubleClick}
        />

        <div
          data-tauri-drag-region={windowState.isTauriWindow ? true : undefined}
          onDoubleClick={handleTitleBarDoubleClick}
          className="flex min-w-0 items-center justify-center gap-2 px-2 text-center select-none"
          dir={direction}
        >
          {activeTabDirty && <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />}
          <div className="min-w-0 truncate text-sm font-semibold text-foreground">{activeTabTitle}</div>
          {activeTabDirty && <span className="sr-only">{t("workspace.controls.dirty", { namespace: "shell" })}</span>}
        </div>

        <ChromeUtilityActions compact={false} model={model} />

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

      {showDetachedTabs && (
        <div className="px-2 py-2" dir={direction} data-testid="default-detached-tabbar">
          <TabBar />
        </div>
      )}
    </div>
  );
}

export function BrowserChrome(props: BrowserChromeProps) {
  const model = useShellChromeModel(props);

  return (
    <>
      {model.isBrowserTabs ? (
        <BrowserTitleBar model={model} />
      ) : (
        <DefaultTitleBar model={model} />
      )}

      <NotificationsPanel
        isOpen={model.notificationsOpen}
        onClose={model.closeNotifications}
      />
    </>
  );
}
