import { useState } from "react";
import { Bell, Search, Plus, ChevronDown, PanelLeft, Building2, GitBranch, LogOut, User, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { NotificationsPanel } from "@/components/erp/NotificationsPanel";
import { GlobalSearch } from "@/components/erp/GlobalSearch";

interface TopBarProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export function TopBar({ onToggleSidebar, sidebarOpen = true }: TopBarProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  const handleNewInvoice = () => {
    navigate("/sales-invoices");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("erp:open-new-invoice"));
    }, 100);
  };

  const handleNewPurchaseInvoice = () => {
    navigate("/purchase-invoices");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("erp:open-new-purchase-invoice"));
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

        <Button
          variant="outline"
          className="flex-1 max-w-md justify-start text-muted-foreground"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="w-4 h-4 ml-2" />
          بحث شامل في النظام...
        </Button>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 hidden md:flex">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">شركة النجاح التجارية</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>تبديل الشركة</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>شركة بردى للصناعة</DropdownMenuItem>
            <DropdownMenuItem>شركة الشام للتجارة</DropdownMenuItem>
            <DropdownMenuItem>مؤسسة قاسيون</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 hidden lg:flex">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">فرع دمشق</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>تبديل الفرع</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>فرع دمشق</DropdownMenuItem>
            <DropdownMenuItem>فرع حلب</DropdownMenuItem>
            <DropdownMenuItem>فرع حمص</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
            <DropdownMenuItem>عميل جديد</DropdownMenuItem>
            <DropdownMenuItem>منتج جديد</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="relative" onClick={() => setNotificationsOpen(true)}>
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-slate-100 rounded-md px-2 py-1.5 transition">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">أم</AvatarFallback>
              </Avatar>
              <div className="text-right hidden md:block">
                <div className="text-sm font-medium leading-tight">أحمد محمد</div>
                <div className="text-xs text-muted-foreground">مدير عام</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>الحساب الشخصي</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem><User className="w-4 h-4 ml-2" />الملف الشخصي</DropdownMenuItem>
            <DropdownMenuItem><SettingsIcon className="w-4 h-4 ml-2" />الإعدادات</DropdownMenuItem>
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