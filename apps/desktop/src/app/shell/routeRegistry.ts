export interface SystemRouteEntry {
  id: string;
  to: string;
  label: string;
  icon: string;
  groupId: string;
  groupLabel: string;
}

export const ALL_SYSTEM_ROUTES: SystemRouteEntry[] = [
  // ── الرئيسية ──
  { id: "dashboard", to: "/dashboard", label: "لوحة التحكم", icon: "LayoutDashboard", groupId: "main", groupLabel: "الرئيسية" },

  // ── المحاسبة العامة ──
  { id: "accounting-chart", to: "/accounting", label: "دليل الحسابات", icon: "BookOpen", groupId: "accounting", groupLabel: "المحاسبة العامة" },
  { id: "journal", to: "/journal", label: "القيود اليومية", icon: "FileText", groupId: "accounting", groupLabel: "المحاسبة العامة" },
  { id: "accounting-journals", to: "/accounting/journals", label: "دفاتر اليومية", icon: "FileText", groupId: "", groupLabel: "" },
  { id: "accounting-ledger", to: "/accounting/reports/ledger", label: "دفتر الأستاذ", icon: "BarChart3", groupId: "", groupLabel: "" },
  { id: "income-statement", to: "/accounting/reports/income", label: "قائمة الدخل", icon: "DollarSign", groupId: "", groupLabel: "" },
  { id: "trial-balance", to: "/accounting/reports/trial-balance", label: "ميزان المراجعة", icon: "Scale", groupId: "", groupLabel: "" },
  { id: "balance-sheet", to: "/accounting/reports/balance-sheet", label: "الميزانية العمومية", icon: "BarChart3", groupId: "", groupLabel: "" },
  { id: "partner-profit-share", to: "/accounting/reports/partner-profit-share", label: "الشركاء وتقاسم الأرباح", icon: "Users", groupId: "", groupLabel: "" },
  { id: "assets", to: "/assets", label: "إدارة الموجودات", icon: "HardDrive", groupId: "accounting", groupLabel: "المحاسبة العامة" },

  // ── الجهات والعمليات المالية ──
  { id: "partners", to: "/partners", label: "الشركاء ورأس المال", icon: "Users", groupId: "parties", groupLabel: "الجهات والعمليات المالية" },
  { id: "customers", to: "/customers", label: "العملاء", icon: "Users", groupId: "parties", groupLabel: "الجهات والعمليات المالية" },
  { id: "suppliers", to: "/suppliers", label: "الموردون", icon: "Truck", groupId: "parties", groupLabel: "الجهات والعمليات المالية" },
  { id: "expenses", to: "/expenses", label: "بنود المصاريف", icon: "DollarSign", groupId: "parties", groupLabel: "المحاسبة العامة" },
  { id: "payments", to: "/payments", label: "المقبوضات والمدفوعات", icon: "Wallet", groupId: "parties", groupLabel: "الجهات والعمليات المالية" },

  // ── المبيعات والمشتريات ──
  { id: "sales-invoices", to: "/sales-invoices", label: "فواتير المبيعات", icon: "Receipt", groupId: "trade", groupLabel: "المبيعات والمشتريات" },
  { id: "purchase-invoices", to: "/purchase-invoices", label: "فواتير المشتريات", icon: "ShoppingCart", groupId: "trade", groupLabel: "المبيعات والمشتريات" },
  { id: "sales-returns", to: "/sales-returns", label: "مرتجعات المبيعات", icon: "Undo2", groupId: "trade", groupLabel: "المبيعات والمشتريات" },
  { id: "purchase-returns", to: "/purchase-returns", label: "مرتجعات المشتريات", icon: "Undo2", groupId: "trade", groupLabel: "المبيعات والمشتريات" },

  // ── المخزون ──
  { id: "categories", to: "/categories", label: "تصنيفات المواد", icon: "Folders", groupId: "inventory", groupLabel: "المخزون" },
  { id: "materials", to: "/materials", label: "بطاقات المواد", icon: "Package", groupId: "inventory", groupLabel: "المخزون" },
  { id: "opening-balance", to: "/opening-balance", label: "فاتورة أول المدة", icon: "Layers", groupId: "inventory", groupLabel: "المحاسبة العامة" },
  { id: "inventory", to: "/inventory", label: "حركات المخزون", icon: "Warehouse", groupId: "inventory", groupLabel: "المخزون" },
  { id: "transfers", to: "/inventory/transfers", label: "التحويلات", icon: "ArrowLeftRight", groupId: "inventory", groupLabel: "المخزون" },
  { id: "warehouses", to: "/inventory/warehouses", label: "المستودعات", icon: "Warehouse", groupId: "inventory", groupLabel: "المخزون" },
  { id: "damaged", to: "/damaged", label: "التالف والهدر", icon: "AlertTriangle", groupId: "inventory", groupLabel: "المخزون" },
  { id: "production", to: "/production", label: "الإنتاج", icon: "Factory", groupId: "inventory", groupLabel: "المخزون" },
  { id: "adjustments", to: "/adjustments", label: "تسويات المخزون", icon: "ClipboardCheck", groupId: "inventory", groupLabel: "المخزون" },

  // ── التقارير والإدارة ──
  { id: "reports", to: "/reports", label: "التقارير", icon: "BarChart3", groupId: "admin", groupLabel: "التقارير والإدارة" },
  { id: "users", to: "/users", label: "المستخدمون والصلاحيات", icon: "Shield", groupId: "admin", groupLabel: "التقارير والإدارة" },
  { id: "settings", to: "/settings", label: "الإعدادات", icon: "Settings", groupId: "admin", groupLabel: "التقارير والإدارة" },
  { id: "audit-log", to: "/audit-log", label: "سجل النشاط", icon: "History", groupId: "admin", groupLabel: "التقارير والإدارة" },
];

export interface SystemRouteGroup {
  id: string;
  title: string;
  icon: string;
  items: SystemRouteEntry[];
}

export const SYSTEM_ROUTE_GROUPS: SystemRouteGroup[] = [
  {
    id: "main",
    title: "الرئيسية",
    icon: "LayoutDashboard",
    items: ALL_SYSTEM_ROUTES.filter(r => r.groupId === "main"),
  },
  {
    id: "accounting",
    title: "المحاسبة العامة",
    icon: "BookOpen",
    items: ALL_SYSTEM_ROUTES.filter(r => r.groupId === "accounting"),
  },
  {
    id: "parties",
    title: "الجهات والعمليات المالية",
    icon: "Users",
    items: ALL_SYSTEM_ROUTES.filter(r => r.groupId === "parties"),
  },
  {
    id: "trade",
    title: "المبيعات والمشتريات",
    icon: "Receipt",
    items: ALL_SYSTEM_ROUTES.filter(r => r.groupId === "trade"),
  },
  {
    id: "inventory",
    title: "المخزون",
    icon: "Package",
    items: ALL_SYSTEM_ROUTES.filter(r => r.groupId === "inventory"),
  },
  {
    id: "admin",
    title: "التقارير والإدارة",
    icon: "Settings",
    items: ALL_SYSTEM_ROUTES.filter(r => r.groupId === "admin"),
  },
];

export function findRouteByTo(to: string): SystemRouteEntry | undefined {
  return ALL_SYSTEM_ROUTES.find(r => r.to === to);
}

export function findRouteById(id: string): SystemRouteEntry | undefined {
  return ALL_SYSTEM_ROUTES.find(r => r.id === id);
}
