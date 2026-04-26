import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, FileText, Users, Truck, Receipt,
  ShoppingCart, Wallet, Package, Warehouse, AlertTriangle,
  Factory, ClipboardCheck, BarChart3, Shield, Settings, History, Layers, X, HardDrive
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
      { to: "/products", label: "المنتجات", icon: Package },
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
  return (
    <aside className="h-screen w-64 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] flex flex-col border-l border-[hsl(var(--sidebar-border))]">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-[hsl(var(--sidebar-border))]">
        <div className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center">
          <Layers className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-base leading-tight">نظام الإدارة</div>
          <div className="text-xs opacity-70">المحاسبة والمخزون</div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/10">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-60">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-white/15 text-white font-medium"
                          : "hover:bg-white/5"
                      )
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[hsl(var(--sidebar-border))] p-4 text-xs opacity-70">
        الإصدار 1.0.0 2026
      </div>
    </aside>
  );
}