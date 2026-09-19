import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Building2, ChevronDown, DollarSign, Mic, Search, Settings as SettingsIcon, Zap } from "lucide-react";
import type { CompanySettings } from "@erp/shared-types";
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

export function BrowserChrome({
  isExchangeVisible,
  onToggleExchange,
}: BrowserChromeProps) {
  const { settings } = useAppearance();
  const { hasMultipleCurrencies } = useCurrencyContext();
  const { openSearch } = useGlobalSearch();
  const { language, setLanguage, t } = useLocalization();
  const { tabs, openTab } = useTabs();
  const voice = useVoice();
  const { executeCommand } = useCommands();
  const windowState = useDesktopWindowState();
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  const handleNewCustomer = useCallback(() => {
    openTab({
      id: `/customers/new-${Date.now()}`,
      title: t("topbar.newCustomer", { namespace: "shell" }),
      path: "/customers",
      closable: true,
    });
    window.dispatchEvent(new CustomEvent("erp:open-new-customer"));
  }, [openTab, t]);

  const handleNewSupplier = useCallback(() => {
    openTab({
      id: `/suppliers/new-${Date.now()}`,
      title: t("topbar.newSupplier", { namespace: "shell" }),
      path: "/suppliers",
      closable: true,
    });
    window.dispatchEvent(new CustomEvent("erp:open-new-supplier"));
  }, [openTab, t]);

  const handleNewProduct = useCallback(() => {
    openTab({
      id: `/materials/new-${Date.now()}`,
      title: t("topbar.newProduct", { namespace: "shell" }),
      path: "/materials",
      closable: true,
    });
    window.dispatchEvent(new CustomEvent("erp:open-new-product"));
  }, [openTab, t]);

  const handleTitleBarDoubleClick = useCallback(() => {
    if (!windowState.isTauriWindow) return;
    void windowState.toggleMaximize();
  }, [windowState]);

  return (
    <>
      <div
        className={cn(
          "border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
          windowState.isFocused ? "shadow-sm" : "opacity-95",
        )}
      >
        <div
          className={cn(
            "grid grid-cols-[minmax(0,280px)_1fr_auto] items-center gap-3 border-b border-border/70 px-3 py-2",
            windowState.isMaximized ? "pt-1" : "pt-2",
          )}
        >
          <div
            data-tauri-drag-region={windowState.isTauriWindow ? true : undefined}
            onDoubleClick={handleTitleBarDoubleClick}
            className="flex min-w-0 items-center gap-3 select-none"
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
            className="flex min-w-0 items-center justify-center gap-2 px-2 text-center select-none"
          >
            {activeTab?.dirty && <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />}
            <div className="min-w-0 truncate text-sm font-semibold text-foreground">{activeTab?.title || appTitle}</div>
            {activeTab?.dirty && <span className="sr-only">{t("workspace.controls.dirty", { namespace: "shell" })}</span>}
          </div>

          <div className="flex justify-end">
            <WindowControls
              isMaximized={windowState.isMaximized || windowState.isFullscreen}
              disabled={!windowState.ready}
              onMinimize={windowState.minimize}
              onToggleMaximize={windowState.toggleMaximize}
              onClose={windowState.close}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-2 py-2">
          <div className="min-w-0 flex-1">
            <TabBar />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {settings.show.search && (
              <Button
                variant="ghost"
                size="icon"
                onClick={openSearch}
                aria-label={t("globalSearch", { namespace: "shell" })}
                title={t("globalSearch", { namespace: "shell" })}
                className="hidden h-9 w-9 rounded-lg lg:inline-flex"
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
                className="hidden h-9 w-9 rounded-lg lg:inline-flex"
              >
                <DollarSign className="h-4 w-4" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-border/70 px-3">
                  <Zap className="h-4 w-4" />
                  <span className="hidden xl:inline">{t("topbar.quickAction", { namespace: "shell" })}</span>
                </Button>
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
                <DropdownMenuItem onClick={handleNewCustomer}>
                  {t("topbar.newCustomer", { namespace: "shell" })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleNewSupplier}>
                  {t("topbar.newSupplier", { namespace: "shell" })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleNewProduct}>
                  {t("topbar.newProduct", { namespace: "shell" })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={voice.open}
              aria-label={t("voice", { namespace: "shell" })}
              title={t("voice", { namespace: "shell" })}
              className="hidden h-9 w-9 rounded-lg sm:inline-flex"
            >
              <Mic className="h-4 w-4" />
            </Button>

            {settings.show.notifications && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotificationsOpen(true)}
                aria-label={t("notifications", { namespace: "shell" })}
                title={t("notifications", { namespace: "shell" })}
                className="relative h-9 w-9 rounded-lg"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-destructive" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-background px-2.5 text-sm transition hover:bg-accent">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">أ</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-start lg:block">
                    <span className="block text-[11px] font-semibold leading-tight">{t("topbar.user", { namespace: "shell" })}</span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("topbar.account", { namespace: "shell" })}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openTab({ id: "/settings", title: t("topbar.settings", { namespace: "shell" }), path: "/settings", closable: true })}>
                  <SettingsIcon className="me-2 h-4 w-4" />
                  {t("topbar.settings", { namespace: "shell" })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage(language === "ar" ? "en" : "ar")}>
                  <SettingsIcon className="me-2 h-4 w-4" />
                  {language === "ar"
                    ? t("topbar.switchToEnglish", { namespace: "shell" })
                    : t("topbar.switchToArabic", { namespace: "shell" })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <NotificationsPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </>
  );
}
