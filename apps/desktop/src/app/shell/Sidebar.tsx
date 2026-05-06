import { useLocation, Link } from "react-router-dom";
import { useTabs } from "@/context/TabContext";
import {
  LayoutDashboard, BookOpen, FileText, Users, Truck, Receipt,
  ShoppingCart, Wallet, Package, Warehouse, AlertTriangle,
  Factory, ClipboardCheck, BarChart3, Shield, Settings, History, Layers, X, HardDrive, Folders, DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "الرئيسية",
    items: [
      { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    ],
  },
  {
    title: "المحاسبة",
    items: [
      { to: "/accounting", label: "دليل الحسابات", icon: BookOpen },
      { to: "/partners", label: "الشركاء ورأس المال", icon: Users },
      { to: "/journal", label: "القيود اليومية", icon: FileText },
      { to: "/assets", label: "إدارة الموجودات", icon: HardDrive },
    ],
  },
  {
    title: "المبيعات والمشتريات",
    items: [
      { to: "/customers", label: "العملاء", icon: Users },
      { to: "/suppliers", label: "الموردون", icon: Truck },
      { to: "/sales-invoices", label: "فواتير المبيعات", icon: Receipt },
      { to: "/purchase-invoices", label: "فواتير المشتريات", icon: ShoppingCart },
      { to: "/payments", label: "المقبوضات والمدفوعات", icon: Wallet },
    ],
  },
  {
    title: "المخزون",
    items: [
      { to: "/categories", label: "تصنيفات المواد", icon: Folders },
      { to: "/materials", label: "بطاقات المواد", icon: Package },
      { to: "/opening-balance", label: "فاتورة أول المدة", icon: Layers },
      { to: "/inventory", label: "حركات المخزون", icon: Warehouse },
      { to: "/damaged", label: "التالف والهدر", icon: AlertTriangle },
      { to: "/production", label: "الإنتاج", icon: Factory },
      { to: "/adjustments", label: "تسويات المخزون", icon: ClipboardCheck },
    ],
  },
  {
    title: "التقارير والإدارة",
    items: [
      { to: "/reports", label: "التقارير", icon: BarChart3 },
      { to: "/currencies", label: "إدارة العملات", icon: DollarSign },
      { to: "/users", label: "المستخدمون والصلاحيات", icon: Shield },
      { to: "/settings", label: "الإعدادات", icon: Settings },
      { to: "/audit-log", label: "سجل النشاط", icon: History },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export function Sidebar({ collapsed, onClose }: SidebarProps) {
  const { openTab, updateMainTab, activeTabId } = useTabs();
  const location = useLocation();

  const handleNavClick = (e: React.MouseEvent, item: NavItem) => {
    e.preventDefault();

    if (e.ctrlKey) {
      // Ctrl + Click opens a new unique tab
      openTab({ 
        id: `${item.to}-${Date.now()}`, 
        title: item.label, 
        path: item.to,
        closable: true
      });
    } else {
      // All regular sidebar clicks update the main background view
      // This includes dashboard and all module lists
      updateMainTab({ 
        title: item.label, 
        path: item.to 
      });
    }

    if (onClose && window.innerWidth < 1024) onClose();
  };

  return (
    <aside className="h-screen w-64 bg-slate-900 text-white flex flex-col border-l border-slate-800">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/5">
        <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm leading-tight text-white">نظام الإدارة المتكامل</div>
          <div className="text-[10px] text-slate-400 font-medium">المحاسبة والمخزون</div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/10 text-slate-400">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-hide">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">
              {group.title}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = activeTabId === item.to || location.pathname === item.to;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={(e) => handleNavClick(e, item)}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-medium"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )
                    }
                    >
                      <item.icon className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                      )} />
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <div className="mr-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] text-slate-500 font-medium tracking-wide">الإصدار 1.2.0 — نظام الألسنة</span>
      </div>
    </aside>
  );
}