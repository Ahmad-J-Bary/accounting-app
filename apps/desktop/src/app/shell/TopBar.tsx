import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Bell, Search, Plus, Building2, LogOut, Settings as SettingsIcon, DollarSign, ChevronDown, Mic } from "lucide-react";
import { useAppearance } from '@shared/hooks/useAppearance';
import { useSidebarLayout, useNavLabels } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
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
import { NotificationsPanel } from '@app/shell/NotificationsPanel';
import { useTabs } from '@app/providers/TabContext';
import { ICON_MAP } from './sidebarConfig';
import type { SidebarGroupConfig, SidebarItemConfig } from '@shared/types/sidebar-config';
import { UpdateBanner } from '@modules/core/update/components/UpdateBanner';
import { useCurrencyContext } from '@app/providers/CurrencyContext';
import { settingsService } from '@modules/core/api/settingsService';
import type { CompanySettings } from "@erp/shared-types";
import { useGlobalSearch } from '@app/providers/useGlobalSearch';
import { useVoice } from '@app/providers/VoiceProvider';
import { useLocalization } from '@app/providers/LocalizationProvider';
import { useCommands } from '@app/providers/useCommands';

interface TopBarProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
  merged?: boolean;
  mergedSlim?: boolean;
}

export function TopBar({ 
  isExchangeVisible,
  onToggleExchange,
  merged = false,
  mergedSlim = false,
}: TopBarProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const { openTab, updateMainTab, activeTabId } = useTabs();
  const { hasMultipleCurrencies } = useCurrencyContext();
  const { settings: appearance } = useAppearance();
  const { openSearch } = useGlobalSearch();
  const voice = useVoice();
  const { language, setLanguage, t } = useLocalization();
  const { itemLabel, groupTitle } = useNavLabels();
  const { executeCommand } = useCommands();
  const showSearch = appearance.show.search;
  const showNotifications = appearance.show.notifications;
  const isHorizontalDark = appearance.horizontalNavbarAppearance === 'dark';

  const loadSettings = () => {
    settingsService.getSettings()
      .then(setSettings)
      .catch(() => {});
  };

  useEffect(() => {
    loadSettings();
    const handler = () => loadSettings();
    window.addEventListener("erp:settings-updated", handler);
    return () => window.removeEventListener("erp:settings-updated", handler);
  }, []);

  // ── Merged nav items ──
  const { layout } = useSidebarLayout();
  const location = useLocation();
  const visibleNavGroups = layout.groups.filter(g => g.visible).sort((a, b) => a.order - b.order);

  const handleNewCustomer = () => {
    openTab({ 
      id: `/customers/new-${Date.now()}`, 
      title: t("topbar.newCustomer", { namespace: "shell",  }), 
      path: "/customers",
      closable: true
    });
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("erp:open-new-customer"));
    }, 100);
  };

  const handleNewSupplier = () => {
    openTab({ 
      id: `/suppliers/new-${Date.now()}`, 
      title: t("topbar.newSupplier", { namespace: "shell",  }), 
      path: "/suppliers",
      closable: true
    });
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("erp:open-new-supplier"));
    }, 100);
  };

  const handleNewProduct = () => {
    openTab({ 
      id: `/materials/new-${Date.now()}`, 
      title: t("topbar.newProduct", { namespace: "shell",  }), 
      path: "/materials",
      closable: true
    });
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("erp:open-new-product"));
    }, 100);
  };

  const navItemClass = isHorizontalDark
    ? "text-muted-foreground hover:text-foreground hover:bg-accent"
    : "text-muted-foreground hover:text-foreground hover:bg-accent";
  const btnHoverClass = isHorizontalDark ? "hover:bg-accent" : "hover:bg-accent";

  const renderNavItem = (item: SidebarItemConfig, slim: boolean) => {
    const isActive = activeTabId === item.to || location.pathname === item.to;
    const ItemIcon = ICON_MAP[item.icon] ?? null;
    const label = itemLabel(item);

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        openTab({ id: `${item.to}-${Date.now()}`, title: label, path: item.to, closable: true });
      } else {
        updateMainTab({ title: label, path: item.to });
      }
    };

    return (
      <button
        key={item.id}
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 rounded-lg font-semibold transition-all whitespace-nowrap shrink-0",
          slim ? "px-1.5 py-0.5 text-[10px]" : "px-3 py-1.5 text-sm",
          isActive
            ? "text-primary bg-primary/10"
            : navItemClass
        )}
        title={label}
      >
        {ItemIcon && <ItemIcon className={slim ? "w-2.5 h-2.5" : "w-4 h-4"} />}
        <span>{label}</span>
      </button>
    );
  };

  const renderNavGroup = (group: SidebarGroupConfig) => {
    const displayTitle = groupTitle(group);
    const visibleItems = group.items.filter((i: SidebarItemConfig) => i.visible).sort((a: SidebarItemConfig, b: SidebarItemConfig) => a.order - b.order);
    if (visibleItems.length === 0) return null;

    const nonSeparatorItems = visibleItems.filter(i => !i.isSeparator);
    if (nonSeparatorItems.length === 0) return null;
    const GroupIcon = group.icon ? ICON_MAP[group.icon] ?? null : null;

    if (nonSeparatorItems.length === 1) {
      return renderNavItem(nonSeparatorItems[0], mergedSlim);
    }

    const isGroupActive = visibleItems.some(
      (item: SidebarItemConfig) => activeTabId === item.to || location.pathname === item.to
    );

    return (
      <div key={group.id} className="relative group py-0.5">
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-lg font-semibold transition-all whitespace-nowrap shrink-0",
            mergedSlim ? "px-1.5 py-0.5 text-[10px]" : "px-3 py-1.5 text-sm",
            isGroupActive
              ? "text-primary bg-primary/10"
              : navItemClass
          )}
        >
          {GroupIcon && !mergedSlim && <GroupIcon className="w-4 h-4" />}
          <span>{displayTitle}</span>
          <ChevronDown className="w-3 h-3 opacity-60 group-hover:rotate-180 transition-transform duration-200" />
        </button>
        <div
          className={cn(
            "absolute top-full right-0 mt-1 w-56 rounded-xl border p-1.5 shadow-xl opacity-0 translate-y-1 invisible",
            "group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-all duration-200 z-50",
            isHorizontalDark ? "bg-popover border-border" : "bg-popover border-border"
          )}
        >
          <div className="space-y-0.5">
            {visibleItems.map((item: SidebarItemConfig, idx: number) => {
              if (item.isSeparator) {
                return <div key={item.id || idx} className="h-px mx-2 my-1.5 bg-border" />;
              }

              const isActive = activeTabId === item.to || location.pathname === item.to;
              const ItemIcon = ICON_MAP[item.icon] ?? null;
              const label = itemLabel(item);

              const handleClick = (e: React.MouseEvent) => {
                e.preventDefault();
                if (e.ctrlKey) {
                  openTab({ id: `${item.to}-${Date.now()}`, title: label, path: item.to, closable: true });
                } else {
                  updateMainTab({ title: label, path: item.to });
                }
              };

              return (
                <button
                  key={item.id}
                  onClick={handleClick}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right text-sm font-medium transition-all",
                    isActive
                      ? "text-primary bg-primary/10"
                      : navItemClass
                  )}
                >
                  {ItemIcon && <ItemIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />}
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── right actions block (reused in both merged and non-merged) ──
  const rightActions = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 active:scale-95 transition-all">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("topbar.quickAction", { namespace: "shell",  })}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 text-right">
          <DropdownMenuItem onClick={() => executeCommand("new-sales-invoice")} className="cursor-pointer">{t("topbar.newSalesInvoice", { namespace: "shell",  })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => executeCommand("new-purchase-invoice")} className="cursor-pointer">{t("topbar.newPurchaseInvoice", { namespace: "shell",  })}</DropdownMenuItem>
          <DropdownMenuItem>{t("topbar.newReceiptVoucher", { namespace: "shell",  })}</DropdownMenuItem>
          <DropdownMenuItem>{t("topbar.newPaymentVoucher", { namespace: "shell",  })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => executeCommand("new-journal-entry")}>{t("topbar.newJournalEntry", { namespace: "shell",  })}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleNewCustomer} className="cursor-pointer">{t("topbar.newCustomer", { namespace: "shell",  })}</DropdownMenuItem>
          <DropdownMenuItem onClick={handleNewSupplier} className="cursor-pointer">{t("topbar.newSupplier", { namespace: "shell",  })}</DropdownMenuItem>
          <DropdownMenuItem onClick={handleNewProduct} className="cursor-pointer">{t("topbar.newProduct", { namespace: "shell",  })}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasMultipleCurrencies && (
        <Button
          variant={isExchangeVisible ? "secondary" : "ghost"}
          size="icon"
          onClick={onToggleExchange}
          title={isExchangeVisible ? t("topbar.hideExchangeRate", { namespace: "shell",  }) : t("topbar.showExchangeRate", { namespace: "shell",  })}
          className={cn(isExchangeVisible && "bg-primary/10 text-primary hover:bg-primary/20")}
        >
          <DollarSign className="w-5 h-5" />
        </Button>
      )}

      {merged && showSearch && (
          <Button variant="ghost" size="icon" onClick={openSearch} title={t("globalSearch", { namespace: "shell",  })}>
            <Search className="w-5 h-5" />
          </Button>
      )}

      <Button variant="ghost" size="icon" onClick={voice.open} title={t("voice", { namespace: "shell",  })}>
        <Mic className="w-5 h-5" />
      </Button>

      {showNotifications && (
        <Button variant="ghost" size="icon" className="relative" onClick={() => setNotificationsOpen(true)}>
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-destructive rounded-full" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {mergedSlim ? (
            <button className={cn("flex items-center gap-1 rounded-md px-1 py-0.5 transition", btnHoverClass)}>
              <span className={cn("text-[10px] font-medium leading-tight", isHorizontalDark && "text-foreground")}>{t("topbar.user", { namespace: "shell",  })}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>
          ) : (
            <button className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 transition", btnHoverClass)}>
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">أ</AvatarFallback>
              </Avatar>
              <div className="text-right hidden md:block">
                <div className={cn("text-sm font-medium leading-tight", isHorizontalDark && "text-foreground")}>{t("topbar.user", { namespace: "shell",  })}</div>
              </div>
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t("topbar.account", { namespace: "shell",  })}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openTab({ id: '/settings', title: t("topbar.settings", { namespace: "shell",  }), path: '/settings', closable: true })}>
            <SettingsIcon className="w-4 h-4 ms-2" />{t("topbar.settings", { namespace: "shell",  })}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLanguage(language === "ar" ? "en" : "ar")}>
            <SettingsIcon className="w-4 h-4 ms-2" />
            {language === "ar" ? t("topbar.switchToEnglish", { namespace: "shell",  }) : t("topbar.switchToArabic", { namespace: "shell",  })}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><LogOut className="w-4 h-4 ms-2" />{t("topbar.logout", { namespace: "shell",  })}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <>
      <header className={cn(
        "flex items-center px-4 md:px-6 gap-2 sticky top-0 z-30 backdrop-blur-sm",
        isHorizontalDark
          ? "bg-background/95 text-foreground border-b border-border shadow-sm"
          : "bg-background/95 border-b border-border shadow-sm",
        merged ? (mergedSlim ? "h-10" : "h-14") : "h-14"
      )}>
        {/* يسار: اسم الشركة */}
        <div className={cn("flex items-center gap-2.5 shrink-0", merged && "flex-1 justify-start")}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm ring-1 ring-primary/20 shrink-0">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 hidden sm:flex items-center gap-1.5">
            <span className={cn("text-sm font-extrabold leading-tight", isHorizontalDark ? "text-foreground" : "text-foreground")}>{t("topbar.brandName", { namespace: "shell",  })}</span>
            <span className={cn("text-xs select-none", isHorizontalDark ? "text-muted-foreground" : "text-muted-foreground")}>|</span>
            <span className={cn("text-sm font-semibold leading-tight truncate", isHorizontalDark ? "text-muted-foreground" : "text-muted-foreground")}>{settings?.company_name || t("topbar.companyFallback", { namespace: "shell",  })}</span>
          </div>
          {merged && <UpdateBanner variant="slim" dark={isHorizontalDark} />}
        </div>

          {!merged && <UpdateBanner variant="stacked" dark={isHorizontalDark} />}
        {merged ? (
          /* مدمج: عناصر التنقل في المنتصف */
          <div className="flex items-center gap-0.5 overflow-visible">
            {visibleNavGroups.map(renderNavGroup)}
          </div>
        ) : (
          /* غير مدمج: حقل البحث في المنتصف */
          <div className="flex-1 flex justify-center">
            {showSearch && (
              <Button
                variant="outline"
                className="w-full max-w-md justify-start text-muted-foreground hover:shadow-sm active:scale-[0.98] transition-all"
                onClick={openSearch}
              >
                <Search className="w-4 h-4 ms-2" />
                {t("topbar.searchInSystem", { namespace: "shell",  })}
              </Button>
            )}
          </div>
        )}

        {/* يمين: الإجراءات السريعة */}
        <div className={cn("flex items-center gap-1 shrink-0", merged && "flex-1 justify-end")}>
          {rightActions}
        </div>
      </header>

      <NotificationsPanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </>
  );
}
