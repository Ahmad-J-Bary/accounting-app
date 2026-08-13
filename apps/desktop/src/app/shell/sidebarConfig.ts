import {
  LayoutDashboard, BookOpen, FileText, Users, Truck, Receipt,
  ShoppingCart, Wallet, Package, Warehouse, AlertTriangle,
  Factory, ClipboardCheck, BarChart3, Shield, Settings, History, Layers,
  HardDrive, Folders, DollarSign, Undo2, GitMerge, ArrowLeftRight,
  Link, FolderPlus, Building2, Minus, PackageOpen
} from "lucide-react";
import type { NavLayoutType, NavSidebarSettings } from '@shared/types/sidebar-settings';
import type { SidebarGroupConfig, SidebarItemConfig } from '@shared/types/sidebar-config';
import { SYSTEM_ROUTE_GROUPS } from './routeRegistry';

// ─── Icon registry ──────────────────────────────────────────
export const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, BookOpen, FileText, Users, Truck, Receipt,
  ShoppingCart, Wallet, Package, Warehouse, AlertTriangle,
  Factory, ClipboardCheck, BarChart3, Shield, Settings, History, Layers,
  HardDrive, Folders, DollarSign, Undo2, GitMerge, ArrowLeftRight,
  Link, FolderPlus, Building2, Minus, PackageOpen,
};

export interface NavItem {
  id: string;
  to: string;
  label: string;
  icon: React.ElementType;
  isSeparator?: boolean;
}

export interface NavGroup {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
}

// ─── NAV_GROUPS — مبني من سجل المسارات —─────────────────────
export const NAV_GROUPS: NavGroup[] = SYSTEM_ROUTE_GROUPS.map(group => ({
  id: group.id,
  title: group.title,
  icon: group.icon,
  items: group.items.map(item => ({
    id: item.id,
    to: item.to,
    label: item.label,
    icon: ICON_MAP[item.icon] ?? LayoutDashboard,
    isSeparator: item.isSeparator,
  })),
}));

// ─── بناء SidebarLayoutConfig الافتراضي من NAV_GROUPS ──────
export function buildDefaultLayout(): import('@shared/types/sidebar-config').SidebarLayoutConfig {
  const groups: SidebarGroupConfig[] = NAV_GROUPS.map((group, gi) => ({
    id: group.id,
    defaultTitle: group.title,
    customTitle: undefined,
    icon: group.icon,
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
      order: ii,
      isSeparator: item.isSeparator ?? false,
    } satisfies SidebarItemConfig)),
  }));

  return { groups, pinnedItemIds: [], version: 3 };
}

// ─── LAYOUT_PRESETS ──────────────────────────────────────────
export const LAYOUT_PRESETS: Record<NavLayoutType, Partial<NavSidebarSettings>> = {
  vertical: {
    navWidth: 256, navCollapsed: false, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: true, navBackground: 'bg-slate-900',
  },
  'topnav-slim': {
    navWidth: 0, navCollapsed: false, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: true, navBackground: 'bg-slate-900',
  },
  'navbar-horizontal': {
    navWidth: 0, navCollapsed: false, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: true, navBackground: 'bg-slate-900',
  },
  'horizontal-slim': {
    navWidth: 0, navCollapsed: false, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: true, navBackground: 'bg-slate-900',
  },
  'combo-nav': {
    navWidth: 200, navCollapsed: false, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: true, navBackground: 'bg-slate-900',
  },
  'combo-nav-slim': {
    navWidth: 200, navCollapsed: false, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: true, navBackground: 'bg-slate-900',
  },
  'combo-nav-stacked': {
    navWidth: 200, navCollapsed: false, navIconOnly: false,
    navShowLabels: true, navShowSectionHeaders: true, navBackground: 'bg-slate-900',
  },
};
