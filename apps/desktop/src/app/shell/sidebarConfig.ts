import {
  LayoutDashboard, BookOpen, FileText, Users, Truck, Receipt,
  ShoppingCart, Wallet, Package, Warehouse, AlertTriangle,
  Factory, ClipboardCheck, BarChart3, Shield, Settings, History, Layers,
  HardDrive, Folders, DollarSign, Undo2, GitMerge
} from "lucide-react";
import type { NavLayoutType, NavSidebarSettings } from '@shared/types/sidebar-settings';
import type { SidebarGroupConfig, SidebarItemConfig } from '@shared/types/sidebar-config';

// ─── Icon registry (لحل مشكلة direct icon في config) ───────────────────────
export const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, BookOpen, FileText, Users, Truck, Receipt,
  ShoppingCart, Wallet, Package, Warehouse, AlertTriangle,
  Factory, ClipboardCheck, BarChart3, Shield, Settings, History, Layers,
  HardDrive, Folders, DollarSign, Undo2, GitMerge,
};

export interface NavItem {
  id: string;
  to: string;
  label: string;
  icon: React.ElementType;
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

// ─── NAV_GROUPS — المصدر الثابت لبيانات التنقل ───────────────────────────────
// الـ routes والأيقونات والـ IDs لا تتغير أبداً
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    title: "الرئيسية",
    items: [
      { id: "dashboard", to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    ],
  },
  {
    id: "accounting",
    title: "المحاسبة العامة",
    items: [
      { id: "accounting-chart", to: "/accounting", label: "دليل الحسابات", icon: BookOpen },
      { id: "journal", to: "/journal", label: "القيود اليومية", icon: FileText },
      { id: "assets", to: "/assets", label: "إدارة الموجودات", icon: HardDrive },
    ],
  },
  {
    id: "parties",
    title: "الجهات والعمليات المالية",
    items: [
      { id: "partners", to: "/partners", label: "الشركاء ورأس المال", icon: Users },
      { id: "customers", to: "/customers", label: "العملاء", icon: Users },
      { id: "suppliers", to: "/suppliers", label: "الموردون", icon: Truck },
      { id: "expenses", to: "/expenses", label: "بنود المصاريف", icon: DollarSign },
      { id: "payments", to: "/payments", label: "المقبوضات والمدفوعات", icon: Wallet },
    ],
  },
  {
    id: "trade",
    title: "المبيعات والمشتريات",
    items: [
      { id: "sales-invoices", to: "/sales-invoices", label: "فواتير المبيعات", icon: Receipt },
      { id: "purchase-invoices", to: "/purchase-invoices", label: "فواتير المشتريات", icon: ShoppingCart },
      { id: "sales-returns", to: "/sales-returns", label: "مرتجعات المبيعات", icon: Undo2 },
      { id: "purchase-returns", to: "/purchase-returns", label: "مرتجعات المشتريات", icon: Undo2 },
    ],
  },
  {
    id: "inventory",
    title: "المخزون",
    items: [
      { id: "categories", to: "/categories", label: "تصنيفات المواد", icon: Folders },
      { id: "materials", to: "/materials", label: "بطاقات المواد", icon: Package },
      { id: "opening-balance", to: "/opening-balance", label: "فاتورة أول المدة", icon: Layers },
      { id: "inventory-moves", to: "/inventory", label: "حركات المخزون", icon: Warehouse },
      { id: "damaged", to: "/damaged", label: "التالف والهدر", icon: AlertTriangle },
      { id: "production", to: "/production", label: "الإنتاج", icon: Factory },
      { id: "adjustments", to: "/adjustments", label: "تسويات المخزون", icon: ClipboardCheck },
    ],
  },
  {
    id: "admin",
    title: "التقارير والإدارة",
    items: [
      { id: "reports", to: "/reports", label: "التقارير", icon: BarChart3 },
      { id: "users", to: "/users", label: "المستخدمون والصلاحيات", icon: Shield },
      { id: "settings", to: "/settings", label: "الإعدادات", icon: Settings },
      { id: "audit-log", to: "/audit-log", label: "سجل النشاط", icon: History },
    ],
  },
];

// ─── بناء SidebarLayoutConfig الافتراضي من NAV_GROUPS ─────────────────────
export function buildDefaultLayout(): import('@shared/types/sidebar-config').SidebarLayoutConfig {
  const groups: SidebarGroupConfig[] = NAV_GROUPS.map((group, gi) => ({
    id: group.id,
    defaultTitle: group.title,
    customTitle: undefined,
    visible: true,
    collapsed: false,
    order: gi,
    items: group.items.map((item, ii) => ({
      id: item.id,
      to: item.to,
      defaultLabel: item.label,
      customLabel: undefined,
      icon: Object.keys(ICON_MAP).find(k => ICON_MAP[k] === item.icon) ?? 'Settings',
      visible: true,
      pinned: false,
      isShortcut: false,
      order: ii,
    } satisfies SidebarItemConfig)),
  }));

  return { groups, pinnedItemIds: [], shortcutIds: [], version: 1 };
}

// ─── LAYOUT_PRESETS (بدون تغيير) ─────────────────────────────────────────────
export const LAYOUT_PRESETS: Record<NavLayoutType, Partial<NavSidebarSettings>> = {
  vertical: {
    navWidth: 256, navCollapsed: false, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: true, navBackground: 'bg-slate-900',
  },
  collapsed: {
    navWidth: 256, navCollapsed: true, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: false, navBackground: 'bg-slate-900',
  },
  'icon-only': {
    navWidth: 256, navCollapsed: true, navIconOnly: true,
    navShowLabels: false, navShowSectionHeaders: false, navBackground: 'bg-slate-900',
  },
  darknav: {
    navWidth: 240, navCollapsed: false, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: true, navBackground: 'bg-slate-950',
  },
  'topnav-slim': {
    navWidth: 0, navCollapsed: false, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: true, navBackground: 'bg-slate-900',
  },
};
