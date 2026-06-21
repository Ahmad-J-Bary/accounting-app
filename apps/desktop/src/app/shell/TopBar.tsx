import { useState, useEffect } from "react";
import { Bell, Search, Plus, PanelLeft, Building2, LogOut, Settings as SettingsIcon, DollarSign } from "lucide-react";
import { useAppearance } from '@shared/hooks/useAppearance';
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
import { useNavigate } from "react-router-dom";
import { NotificationsPanel } from '@app/shell/NotificationsPanel';
import { GlobalSearch } from '@app/shell/GlobalSearch';
import { useTabs } from '@app/providers/TabContext';
import { settingsService } from '@modules/core/api/settingsService';
import type { CompanySettings } from "@erp/shared-types";

interface TopBarProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  isExchangeVisible?: boolean;
  onToggleExchange?: () => void;
}

export function TopBar({ 
  onToggleSidebar, 
  sidebarOpen = true,
  isExchangeVisible,
  onToggleExchange
}: TopBarProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const { openTab } = useTabs();
  const navigate = useNavigate();
  const { settings: appearance } = useAppearance();
  const showSearch = appearance.show.search;
  const showNotifications = appearance.show.notifications;

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

  return (
    <>
      <header className="h-16 bg-white border-b border-border flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30">
        {!sidebarOpen && (
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="transition-all hover:bg-slate-100">
            <PanelLeft className="w-5 h-5" />
          </Button>
        )}

        {showSearch && (
          <Button
            variant="outline"
            className="flex-1 max-w-md justify-start text-muted-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="w-4 h-4 ml-2" />
            بحث شامل في النظام...
          </Button>
        )}

        <div className="flex-1" />

        {/* Company Name */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-700">
            {settings?.company_name || "المنشأة"}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
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

        <Button 
          variant={isExchangeVisible ? "secondary" : "ghost"} 
          size="icon" 
          onClick={onToggleExchange}
          title={isExchangeVisible ? "إخفاء سعر الصرف" : "إظهار سعر الصرف"}
          className={cn(isExchangeVisible && "bg-blue-50 text-blue-600 hover:bg-blue-100")}
        >
          <DollarSign className="w-5 h-5" />
        </Button>

        {showNotifications && (
          <Button variant="ghost" size="icon" className="relative" onClick={() => setNotificationsOpen(true)}>
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-slate-100 rounded-md px-2 py-1.5 transition">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">أ</AvatarFallback>
              </Avatar>
              <div className="text-right hidden md:block">
                <div className="text-sm font-medium leading-tight">المستخدم</div>
                <div className="text-xs text-muted-foreground">النظام المحاسبي</div>
              </div>
            </button>
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
