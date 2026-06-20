import {
  LayoutDashboard, BookOpen, FileText, Users, Truck, Receipt,
  ShoppingCart, Wallet, Package, Warehouse, AlertTriangle,
  Factory, ClipboardCheck, BarChart3, Shield, Settings, History, Layers,
  HardDrive, Folders, DollarSign, Undo2
} from "lucide-react";
import type { NavLayoutType, NavSidebarSettings } from '@shared/types/sidebar-settings';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "الرئيسية",
    items: [
      { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    ],
  },
  {
    title: "المحاسبة العامة",
    items: [
      { to: "/accounting", label: "دليل الحسابات", icon: BookOpen },
      { to: "/journal", label: "القيود اليومية", icon: FileText },
      { to: "/assets", label: "إدارة الموجودات", icon: HardDrive },
    ],
  },
  {
    title: "الجهات والعمليات المالية",
    items: [
      { to: "/partners", label: "الشركاء ورأس المال", icon: Users },
      { to: "/customers", label: "العملاء", icon: Users },
      { to: "/suppliers", label: "الموردون", icon: Truck },
      { to: "/expenses", label: "بنود المصاريف", icon: DollarSign },
      { to: "/payments", label: "المقبوضات والمدفوعات", icon: Wallet },
    ],
  },
  {
    title: "المبيعات والمشتريات",
    items: [
      { to: "/sales-invoices", label: "فواتير المبيعات", icon: Receipt },
      { to: "/purchase-invoices", label: "فواتير المشتريات", icon: ShoppingCart },
      { to: "/sales-returns", label: "مرتجعات المبيعات", icon: Undo2 },
      { to: "/purchase-returns", label: "مرتجعات المشتريات", icon: Undo2 },
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
      { to: "/users", label: "المستخدمون والصلاحيات", icon: Shield },
      { to: "/settings", label: "الإعدادات", icon: Settings },
      { to: "/audit-log", label: "سجل النشاط", icon: History },
    ],
  },
];

export const LAYOUT_PRESETS: Record<NavLayoutType, Partial<NavSidebarSettings>> = {
  vertical: {
    navWidth: 256,
    navCollapsed: false,
    navIconOnly: false,
    navShowLabels: true,
    navShowSectionHeaders: true,
    navBackground: 'bg-slate-900',
  },
  collapsed: {
    navWidth: 256,
    navCollapsed: true,
    navIconOnly: false,
    navShowLabels: true,
    navShowSectionHeaders: false,
    navBackground: 'bg-slate-900',
  },
  'icon-only': {
    navWidth: 256,
    navCollapsed: true,
    navIconOnly: true,
    navShowLabels: false,
    navShowSectionHeaders: false,
    navBackground: 'bg-slate-900',
  },
  darknav: {
    navWidth: 240,
    navCollapsed: false,
    navIconOnly: false,
    navShowLabels: true,
    navShowSectionHeaders: true,
    navBackground: 'bg-slate-950',
  },
  'topnav-slim': {
    navWidth: 0,
    navCollapsed: false,
    navIconOnly: false,
    navShowLabels: true,
    navShowSectionHeaders: true,
    navBackground: 'bg-slate-900',
  },
};
