export interface SystemRouteEntry {
  id: string;
  to: string;
  label: string;
  icon: string;
  groupId: string;
  groupLabel: string;
  isSeparator?: boolean;
}

export const ALL_SYSTEM_ROUTES: SystemRouteEntry[] = [
  // ── الرئيسية ──
  { id: "dashboard", to: "/dashboard", label: "لوحة التحكم", icon: "LayoutDashboard", groupId: "main", groupLabel: "الرئيسية" },

  // ── المحاسبة العامة ──
  { id: "accounting-chart", to: "/accounting", label: "دليل الحسابات", icon: "BookOpen", groupId: "accounting", groupLabel: "المحاسبة العامة" },
  { id: "journal", to: "/journal", label: "القيود اليومية", icon: "FileText", groupId: "accounting", groupLabel: "المحاسبة العامة" },
  { id: "accounting-ledger", to: "/accounting/reports/ledger", label: "دفتر الأستاذ", icon: "BarChart3", groupId: "", groupLabel: "" },
  { id: "opening-balance-migration", to: "/opening-balance-migration", label: "رصيد افتتاح الشركة", icon: "Layers", groupId: "accounting", groupLabel: "المحاسبة العامة" },
  { id: "income-statement", to: "/accounting/reports/income", label: "قائمة الدخل", icon: "DollarSign", groupId: "", groupLabel: "" },
  { id: "trial-balance", to: "/accounting/reports/trial-balance", label: "ميزان المراجعة", icon: "Scale", groupId: "", groupLabel: "" },
  { id: "balance-sheet", to: "/accounting/reports/balance-sheet", label: "الميزانية العمومية", icon: "BarChart3", groupId: "", groupLabel: "" },
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

  // ── الأصول الثابتة (ضمن المحاسبة العامة) ──
  { id: "fixed-assets", to: "/fixed-assets", label: "الأصول الثابتة", icon: "Building2", groupId: "accounting", groupLabel: "المحاسبة العامة" },
  { id: "fiscal-periods", to: "/accounting/fiscal-periods", label: "الفترات المالية", icon: "CalendarDays", groupId: "accounting", groupLabel: "المحاسبة العامة" },

  // ── المخزون ──
  { id: "categories", to: "/categories", label: "تصنيفات المواد", icon: "Folders", groupId: "inventory", groupLabel: "المخزون" },
  { id: "materials", to: "/materials", label: "بطاقات المواد", icon: "Package", groupId: "inventory", groupLabel: "المخزون" },
  { id: "opening-balance", to: "/opening-balance", label: "فاتورة أول المدة", icon: "PackageOpen", groupId: "inventory", groupLabel: "المخزون" },
  { id: "inventory", to: "/inventory", label: "حركات المخزون", icon: "Warehouse", groupId: "inventory", groupLabel: "المخزون" },
  { id: "transfers", to: "/inventory/transfers", label: "التحويلات", icon: "ArrowLeftRight", groupId: "inventory", groupLabel: "المخزون" },
  { id: "warehouses", to: "/inventory/warehouses", label: "المستودعات", icon: "Warehouse", groupId: "inventory", groupLabel: "المخزون" },
  { id: "damaged", to: "/damaged", label: "التالف والهدر", icon: "AlertTriangle", groupId: "inventory", groupLabel: "المخزون" },
  { id: "production", to: "/production", label: "الإنتاج", icon: "Factory", groupId: "inventory", groupLabel: "المخزون" },
  { id: "adjustments", to: "/adjustments", label: "تسويات المخزون", icon: "ClipboardCheck", groupId: "inventory", groupLabel: "المخزون" },

  // ── التقارير ──
  { id: "report-ledger", to: "/accounting/reports/ledger", label: "دفتر الأستاذ العام", icon: "BookOpen", groupId: "reports", groupLabel: "التقارير" },
  { id: "sep-reports-1", to: "", label: "", icon: "", groupId: "reports", groupLabel: "التقارير", isSeparator: true },
  { id: "report-income", to: "/accounting/reports/income", label: "قائمة الدخل", icon: "TrendingUp", groupId: "reports", groupLabel: "التقارير" },
  { id: "report-trial-balance", to: "/accounting/reports/trial-balance", label: "ميزان المراجعة", icon: "Scale", groupId: "reports", groupLabel: "التقارير" },
  { id: "report-balance-sheet", to: "/accounting/reports/balance-sheet", label: "الميزانية العمومية", icon: "BarChart3", groupId: "reports", groupLabel: "التقارير" },
  { id: "sep-reports-2", to: "", label: "", icon: "", groupId: "reports", groupLabel: "التقارير", isSeparator: true },
  { id: "report-partner-profit", to: "/accounting/reports/partners", label: "الشركاء وحقوقهم", icon: "Users", groupId: "reports", groupLabel: "التقارير" },
  { id: "sep-reports-3", to: "", label: "", icon: "", groupId: "reports", groupLabel: "التقارير", isSeparator: true },
  { id: "report-inventory-valuation", to: "/inventory/reports/valuation", label: "جرد وقيمة المخزون", icon: "Package", groupId: "reports", groupLabel: "التقارير" },
  { id: "report-low-stock", to: "/inventory/reports/low-stock", label: "نواقص المخزون", icon: "AlertTriangle", groupId: "reports", groupLabel: "التقارير" },

  // ── الإدارة ──
  { id: "users", to: "/users", label: "المستخدمون والصلاحيات", icon: "Shield", groupId: "admin", groupLabel: "الإدارة" },
  { id: "settings", to: "/settings", label: "الإعدادات", icon: "Settings", groupId: "admin", groupLabel: "الإدارة" },
  { id: "backups", to: "/backups", label: "البيانات والنسخ الاحتياطية", icon: "Database", groupId: "admin", groupLabel: "الإدارة" },
  { id: "audit-log", to: "/audit-log", label: "سجل النشاط", icon: "History", groupId: "admin", groupLabel: "الإدارة" },
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
    id: "reports",
    title: "التقارير",
    icon: "BarChart3",
    items: ALL_SYSTEM_ROUTES.filter(r => r.groupId === "reports"),
  },
  {
    id: "admin",
    title: "الإدارة",
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
