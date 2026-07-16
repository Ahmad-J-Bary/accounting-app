import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Bell, Search, Plus, Building2, LogOut, Settings as SettingsIcon, DollarSign, ChevronDown } from "lucide-react";
import { useAppearance } from '@shared/hooks/useAppearance';
import { useSidebarLayout } from '@shared/hooks';
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
import { GlobalSearch } from '@app/shell/GlobalSearch';
import { useTabs } from '@app/providers/TabContext';
import { ICON_MAP } from './sidebarConfig';
import type { SidebarGroupConfig, SidebarItemConfig } from '@shared/types/sidebar-config';
import { UpdateBanner } from '@modules/core/update/components/UpdateBanner';
import { useCurrencyContext } from '@app/providers/CurrencyContext';
import { settingsService } from '@modules/core/api/settingsService';
import type { CompanySettings } from "@erp/shared-types";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const { openTab, updateMainTab, activeTabId } = useTabs();
  const { hasMultipleCurrencies } = useCurrencyContext();
  const { settings: appearance } = useAppearance();
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

  const handleNewInvoice = () => {
    const id = `/sales-invoices/new-${Date.now()}`;
    openTab({ 
      id, 
      title: "فاتورة مبيعات جديدة", 
      path: id,
      closable: true
    });
  };

  const handleNewPurchaseInvoice = () => {
    const id = `/purchase-invoices/new-${Date.now()}`;
    openTab({ 
      id, 
      title: "فاتورة مشتريات جديدة", 
      path: id,
      closable: true
    });
  };

  const handleNewCustomer = () => {
    openTab({ 
      id: `/customers/new-${Date.now()}`, 
      title: "عميل جديد", 
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
      title: "مورد جديد", 
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
      title: "منتج جديد", 
      path: "/materials",
      closable: true
    });
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("erp:open-new-product"));
    }, 100);
  };

  const navItemClass = isHorizontalDark
    ? "text-slate-400 hover:text-white hover:bg-slate-800/50"
    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100";
  const btnHoverClass = isHorizontalDark ? "hover:bg-slate-800/50" : "hover:bg-slate-100";

  const renderNavItem = (item: SidebarItemConfig, slim: boolean) => {
    const isActive = activeTabId === item.to || location.pathname === item.to;
    const ItemIcon = ICON_MAP[item.icon] ?? null;
    const label = item.customLabel ?? item.defaultLabel;

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
    const displayTitle = group.customTitle ?? group.defaultTitle;
    const visibleItems = group.items.filter((i: SidebarItemConfig) => i.visible).sort((a: SidebarItemConfig, b: SidebarItemConfig) => a.order - b.order);
    if (visibleItems.length === 0) return null;
    const GroupIcon = group.icon ? ICON_MAP[group.icon] ?? null : null;

    if (visibleItems.length === 1) {
      return renderNavItem(visibleItems[0], mergedSlim);
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
            isHorizontalDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
          )}
        >
          <div className="space-y-0.5">
            {visibleItems.map((item: SidebarItemConfig) => {
              const isActive = activeTabId === item.to || location.pathname === item.to;
              const ItemIcon = ICON_MAP[item.icon] ?? null;
              const label = item.customLabel ?? item.defaultLabel;

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
            <span className="hidden sm:inline">إجراء سريع</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 text-right">
          <DropdownMenuItem onClick={handleNewInvoice} className="cursor-pointer">فاتورة مبيعات جديدة</DropdownMenuItem>
          <DropdownMenuItem onClick={handleNewPurchaseInvoice} className="cursor-pointer">فاتورة مشتريات جديدة</DropdownMenuItem>
          <DropdownMenuItem>سند قبض جديد</DropdownMenuItem>
          <DropdownMenuItem>سند صرف جديد</DropdownMenuItem>
          <DropdownMenuItem>قيد يومية جديد</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleNewCustomer} className="cursor-pointer">عميل جديد</DropdownMenuItem>
          <DropdownMenuItem onClick={handleNewSupplier} className="cursor-pointer">مورد جديد</DropdownMenuItem>
          <DropdownMenuItem onClick={handleNewProduct} className="cursor-pointer">منتج جديد</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasMultipleCurrencies && (
        <Button
          variant={isExchangeVisible ? "secondary" : "ghost"}
          size="icon"
          onClick={onToggleExchange}
          title={isExchangeVisible ? "إخفاء سعر الصرف" : "إظهار سعر الصرف"}
          className={cn(isExchangeVisible && "bg-blue-50 text-blue-600 hover:bg-blue-100")}
        >
          <DollarSign className="w-5 h-5" />
        </Button>
      )}

      {merged && showSearch && (
        <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} title="بحث شامل">
          <Search className="w-5 h-5" />
        </Button>
      )}

      {showNotifications && (
        <Button variant="ghost" size="icon" className="relative" onClick={() => setNotificationsOpen(true)}>
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {mergedSlim ? (
            <button className={cn("flex items-center gap-1 rounded-md px-1 py-0.5 transition", btnHoverClass)}>
              <span className={cn("text-[10px] font-medium leading-tight", isHorizontalDark && "text-slate-200")}>المستخدم</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>
          ) : (
            <button className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 transition", btnHoverClass)}>
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">أ</AvatarFallback>
              </Avatar>
              <div className="text-right hidden md:block">
                <div className={cn("text-sm font-medium leading-tight", isHorizontalDark && "text-slate-200")}>المستخدم</div>
              </div>
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>الحساب الشخصي</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openTab({ id: '/settings', title: 'الإعدادات', path: '/settings', closable: true })}>
            <SettingsIcon className="w-4 h-4 ml-2" />الإعدادات
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600"><LogOut className="w-4 h-4 ml-2" />تسجيل الخروج</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <>
      <header className={cn(
        "flex items-center px-4 md:px-6 gap-2 sticky top-0 z-30 backdrop-blur-sm",
        isHorizontalDark
          ? "bg-slate-900/95 text-slate-200 border-b border-slate-700/50 shadow-sm shadow-slate-900/10"
          : "bg-white/95 border-b border-slate-200/70 shadow-sm shadow-slate-200/50",
        merged ? (mergedSlim ? "h-10" : "h-14") : "h-14"
      )}>
        {/* يسار: اسم الشركة */}
        <div className={cn("flex items-center gap-2.5 shrink-0", merged && "flex-1 justify-start")}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm ring-1 ring-primary/20 shrink-0">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 hidden sm:flex items-center gap-1.5">
            <span className={cn("text-sm font-extrabold leading-tight", isHorizontalDark ? "text-slate-100" : "text-slate-800")}>المُواكِب</span>
            <span className={cn("text-xs select-none", isHorizontalDark ? "text-slate-600" : "text-slate-300")}>|</span>
            <span className={cn("text-sm font-semibold leading-tight truncate", isHorizontalDark ? "text-slate-400" : "text-slate-500")}>{settings?.company_name || "المنشأة"}</span>
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
                onClick={() => setSearchOpen(true)}
              >
                <Search className="w-4 h-4 ml-2" />
                بحث شامل في النظام...
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
      <GlobalSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
