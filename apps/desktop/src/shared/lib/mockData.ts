export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  balance: number;
  status: "active" | "inactive";
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  balance: number;
  status: "active" | "inactive";
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  partyName: string;
  total: number;
  paid: number;
  status: "paid" | "partial" | "unpaid" | "overdue" | "draft";
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  balance: number;
  children?: Account[];
}

export interface Payment {
  id: string;
  number: string;
  date: string;
  type: "receipt" | "payment";
  party: string;
  amount: number;
  method: "cash" | "bank" | "check";
  status: "posted" | "draft";
}

export interface StockMovement {
  id: string;
  number: string;
  date: string;
  type: "in" | "out" | "transfer";
  product: string;
  warehouse: string;
  quantity: number;
  reference: string;
}

export interface DamagedItem {
  id: string;
  number: string;
  date: string;
  product: string;
  quantity: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

export interface ProductionOrder {
  id: string;
  number: string;
  date: string;
  product: string;
  quantity: number;
  status: "planned" | "in_progress" | "completed" | "cancelled";
}

export interface StockAdjustment {
  id: string;
  number: string;
  date: string;
  warehouse: string;
  itemsCount: number;
  variance: number;
  status: "draft" | "approved" | "posted";
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
  lastLogin: string;
  status: "active" | "inactive";
}

export interface AuditLog {
  id: string;
  date: string;
  user: string;
  action: string;
  module: string;
  record: string;
  ip: string;
}

export const customers: Customer[] = [
  { id: "1", code: "C-001", name: "شركة النور للتجارة", phone: "0931234567", email: "info@alnoor.com", city: "دمشق", balance: 45000, status: "active" },
  { id: "2", code: "C-002", name: "مؤسسة الفجر", phone: "0997654321", email: "contact@alfajr.com", city: "حلب", balance: 12000, status: "active" },
  { id: "3", code: "C-003", name: "شركة الأمل الحديثة", phone: "0934567890", email: "amal@modern.com", city: "حمص", balance: 0, status: "active" },
  { id: "4", code: "C-004", name: "مؤسسة الريادة", phone: "0999876543", email: "lead@riyada.com", city: "اللاذقية", balance: 78500, status: "active" },
  { id: "5", code: "C-005", name: "شركة الشرق المتحدة", phone: "0931122334", email: "east@united.com", city: "دمشق", balance: 23400, status: "inactive" },
  { id: "6", code: "C-006", name: "مجموعة السلام التجارية", phone: "0999988776", email: "salam@group.com", city: "طرطوس", balance: 95000, status: "active" },
];

export const suppliers: Supplier[] = [
  { id: "1", code: "S-001", name: "مصنع بردى", phone: "0112345678", email: "barada@factory.com", city: "دمشق", balance: 32000, status: "active" },
  { id: "2", code: "S-002", name: "شركة الإمداد السريع", phone: "0213456789", email: "supply@fast.com", city: "حلب", balance: 15000, status: "active" },
  { id: "3", code: "S-003", name: "مؤسسة الجودة للمواد", phone: "0314567890", email: "quality@mat.com", city: "حمص", balance: 8500, status: "active" },
  { id: "4", code: "S-004", name: "التوريدات الذهبية", phone: "0115678901", email: "gold@supply.com", city: "دمشق", balance: 42000, status: "active" },
];

export const salesInvoices: Invoice[] = [
  { id: "1", number: "INV-2026-0145", date: "2026-04-18", partyName: "شركة النور للتجارة", total: 15000, paid: 15000, status: "paid" },
  { id: "2", number: "INV-2026-0144", date: "2026-04-17", partyName: "مؤسسة الفجر", total: 8500, paid: 4000, status: "partial" },
  { id: "3", number: "INV-2026-0143", date: "2026-04-15", partyName: "شركة الأمل الحديثة", total: 22000, paid: 0, status: "unpaid" },
  { id: "4", number: "INV-2026-0142", date: "2026-04-10", partyName: "مؤسسة الريادة", total: 45000, paid: 0, status: "overdue" },
  { id: "5", number: "INV-2026-0141", date: "2026-04-09", partyName: "شركة الخليج المتحد", total: 12500, paid: 12500, status: "paid" },
  { id: "6", number: "INV-2026-0140", date: "2026-04-08", partyName: "مجموعة السلام", total: 67000, paid: 67000, status: "paid" },
  { id: "7", number: "INV-2026-0139", date: "2026-04-07", partyName: "شركة النور للتجارة", total: 9000, paid: 0, status: "draft" },
];

export const purchaseInvoices: Invoice[] = [
  { id: "1", number: "PUR-2026-0089", date: "2026-04-18", partyName: "مصنع الشرق الأوسط", total: 32000, paid: 32000, status: "paid" },
  { id: "2", number: "PUR-2026-0088", date: "2026-04-16", partyName: "شركة الإمداد السريع", total: 15000, paid: 7500, status: "partial" },
  { id: "3", number: "PUR-2026-0087", date: "2026-04-14", partyName: "مؤسسة الجودة للمواد", total: 8500, paid: 0, status: "unpaid" },
  { id: "4", number: "PUR-2026-0086", date: "2026-04-12", partyName: "التوريدات الذهبية", total: 42000, paid: 0, status: "overdue" },
];

export const products: Product[] = [
  { id: "1", code: "P-001", name: "جهاز كمبيوتر محمول HP", category: "إلكترونيات", unit: "قطعة", price: 3500, cost: 2800, stock: 45, minStock: 10 },
  { id: "2", code: "P-002", name: "طابعة ليزر Canon", category: "إلكترونيات", unit: "قطعة", price: 1200, cost: 900, stock: 8, minStock: 10 },
  { id: "3", code: "P-003", name: "ورق تصوير A4", category: "مستلزمات مكتبية", unit: "رزمة", price: 25, cost: 18, stock: 320, minStock: 50 },
  { id: "4", code: "P-004", name: "حبر طابعة أسود", category: "مستلزمات مكتبية", unit: "عبوة", price: 180, cost: 130, stock: 25, minStock: 15 },
  { id: "5", code: "P-005", name: "كرسي مكتبي تنفيذي", category: "أثاث", unit: "قطعة", price: 950, cost: 650, stock: 3, minStock: 5 },
  { id: "6", code: "P-006", name: "مكتب خشبي فاخر", category: "أثاث", unit: "قطعة", price: 2200, cost: 1500, stock: 12, minStock: 5 },
  { id: "7", code: "P-007", name: "شاشة LED 27 بوصة", category: "إلكترونيات", unit: "قطعة", price: 1500, cost: 1100, stock: 18, minStock: 8 },
];

export const accountsTree: Account[] = [
  {
    id: "1", code: "1", name: "الأصول", type: "asset", balance: 1250000,
    children: [
      { id: "11", code: "11", name: "الأصول المتداولة", type: "asset", balance: 750000, children: [
        { id: "111", code: "1101", name: "الصندوق الرئيسي", type: "asset", balance: 45000 },
        { id: "112", code: "1102", name: "المصرف التجاري السوري", type: "asset", balance: 320000 },
        { id: "113", code: "1103", name: "العملاء", type: "asset", balance: 253900 },
        { id: "114", code: "1104", name: "المخزون", type: "asset", balance: 131100 },
      ]},
      { id: "12", code: "12", name: "الأصول الثابتة", type: "asset", balance: 500000, children: [
        { id: "121", code: "1201", name: "الأراضي والمباني", type: "asset", balance: 350000 },
        { id: "122", code: "1202", name: "الأثاث والمعدات", type: "asset", balance: 150000 },
      ]},
    ]
  },
  {
    id: "2", code: "2", name: "الخصوم", type: "liability", balance: 450000,
    children: [
      { id: "21", code: "2101", name: "الموردون", type: "liability", balance: 97500 },
      { id: "22", code: "2102", name: "أوراق الدفع", type: "liability", balance: 120000 },
      { id: "23", code: "2103", name: "ضرائب ورسوم", type: "liability", balance: 32500 },
    ]
  },
  {
    id: "3", code: "3", name: "حقوق الملكية", type: "equity", balance: 600000,
    children: [
      { id: "31", code: "3101", name: "رأس المال", type: "equity", balance: 500000 },
      { id: "32", code: "3102", name: "الأرباح المحتجزة", type: "equity", balance: 100000 },
    ]
  },
  {
    id: "4", code: "4", name: "الإيرادات", type: "revenue", balance: 850000,
    children: [
      { id: "41", code: "4101", name: "إيرادات المبيعات", type: "revenue", balance: 820000 },
      { id: "42", code: "4102", name: "إيرادات أخرى", type: "revenue", balance: 30000 },
    ]
  },
  {
    id: "5", code: "5", name: "المصروفات", type: "expense", balance: 450000,
    children: [
      { id: "51", code: "5101", name: "تكلفة البضاعة المباعة", type: "expense", balance: 300000 },
      { id: "52", code: "5102", name: "الرواتب والأجور", type: "expense", balance: 95000 },
      { id: "53", code: "5103", name: "مصاريف عمومية", type: "expense", balance: 55000 },
    ]
  },
];

export const payments: Payment[] = [
  { id: "1", number: "RCP-2026-0078", date: "2026-04-18", type: "receipt", party: "شركة النور للتجارة", amount: 15000, method: "bank", status: "posted" },
  { id: "2", number: "RCP-2026-0077", date: "2026-04-17", type: "receipt", party: "مؤسسة الفجر", amount: 4000, method: "cash", status: "posted" },
  { id: "3", number: "PAY-2026-0056", date: "2026-04-18", type: "payment", party: "مصنع الشرق الأوسط", amount: 32000, method: "bank", status: "posted" },
  { id: "4", number: "PAY-2026-0055", date: "2026-04-16", type: "payment", party: "شركة الإمداد السريع", amount: 7500, method: "check", status: "posted" },
  { id: "5", number: "RCP-2026-0076", date: "2026-04-15", type: "receipt", party: "شركة الشرق المتحدة", amount: 12500, method: "bank", status: "draft" },
];

export const stockMovements: StockMovement[] = [
  { id: "1", number: "MV-2026-0312", date: "2026-04-18", type: "in", product: "جهاز كمبيوتر محمول HP", warehouse: "المستودع الرئيسي", quantity: 20, reference: "PUR-2026-0089" },
  { id: "2", number: "MV-2026-0311", date: "2026-04-18", type: "out", product: "ورق تصوير A4", warehouse: "المستودع الرئيسي", quantity: 50, reference: "INV-2026-0145" },
  { id: "3", number: "MV-2026-0310", date: "2026-04-17", type: "transfer", product: "شاشة LED 27 بوصة", warehouse: "مستودع حلب", quantity: 5, reference: "TR-0045" },
  { id: "4", number: "MV-2026-0309", date: "2026-04-16", type: "in", product: "كرسي مكتبي تنفيذي", warehouse: "المستودع الرئيسي", quantity: 10, reference: "PUR-2026-0087" },
];

export const damagedItems: DamagedItem[] = [
  { id: "1", number: "DMG-2026-0023", date: "2026-04-18", product: "شاشة LED 27 بوصة", quantity: 2, reason: "كسر أثناء النقل", status: "pending" },
  { id: "2", number: "DMG-2026-0022", date: "2026-04-15", product: "طابعة ليزر Canon", quantity: 1, reason: "عطل فني", status: "approved" },
  { id: "3", number: "DMG-2026-0021", date: "2026-04-12", product: "ورق تصوير A4", quantity: 10, reason: "رطوبة في المستودع", status: "approved" },
  { id: "4", number: "DMG-2026-0020", date: "2026-04-10", product: "حبر طابعة أسود", quantity: 3, reason: "انتهاء الصلاحية", status: "rejected" },
];

export const productionOrders: ProductionOrder[] = [
  { id: "1", number: "PRD-2026-0034", date: "2026-04-18", product: "مكتب خشبي فاخر", quantity: 20, status: "in_progress" },
  { id: "2", number: "PRD-2026-0033", date: "2026-04-15", product: "كرسي مكتبي تنفيذي", quantity: 30, status: "completed" },
  { id: "3", number: "PRD-2026-0032", date: "2026-04-12", product: "مكتب خشبي فاخر", quantity: 15, status: "completed" },
  { id: "4", number: "PRD-2026-0031", date: "2026-04-20", product: "كرسي مكتبي تنفيذي", quantity: 25, status: "planned" },
];

export const stockAdjustments: StockAdjustment[] = [
  { id: "1", number: "ADJ-2026-0012", date: "2026-04-18", warehouse: "المستودع الرئيسي", itemsCount: 15, variance: -1250, status: "draft" },
  { id: "2", number: "ADJ-2026-0011", date: "2026-04-10", warehouse: "مستودع حلب", itemsCount: 8, variance: 340, status: "approved" },
  { id: "3", number: "ADJ-2026-0010", date: "2026-04-01", warehouse: "المستودع الرئيسي", itemsCount: 22, variance: -780, status: "posted" },
];

export const users: User[] = [
  { id: "1", name: "أحمد منصور", email: "ahmed@company.com", role: "مدير عام", branch: "دمشق", lastLogin: "2026-04-19 09:30", status: "active" },
  { id: "2", name: "فاطمة خليل", email: "fatima@company.com", role: "محاسب رئيسي", branch: "دمشق", lastLogin: "2026-04-19 08:15", status: "active" },
  { id: "3", name: "خالد الأسد", email: "khalid@company.com", role: "مدير مبيعات", branch: "حلب", lastLogin: "2026-04-18 16:45", status: "active" },
  { id: "4", name: "نورة جابر", email: "noura@company.com", role: "أمين مستودع", branch: "حمص", lastLogin: "2026-04-18 14:20", status: "active" },
  { id: "5", name: "محمد ديب", email: "mohammed@company.com", role: "محاسب", branch: "دمشق", lastLogin: "2026-04-15 11:00", status: "inactive" },
];

export const auditLogs: AuditLog[] = [
  { id: "1", date: "2026-04-19 09:35", user: "أحمد منصور", action: "إنشاء", module: "فواتير المبيعات", record: "INV-2026-0145", ip: "192.168.1.10" },
  { id: "2", date: "2026-04-19 09:28", user: "فاطمة خليل", action: "تعديل", module: "العملاء", record: "C-001", ip: "192.168.1.15" },
  { id: "3", date: "2026-04-19 08:50", user: "خالد الأسد", action: "حذف", module: "المنتجات", record: "P-099", ip: "192.168.1.22" },
  { id: "4", date: "2026-04-19 08:20", user: "نورة جابر", action: "موافقة", module: "التالف", record: "DMG-2026-0022", ip: "192.168.1.30" },
  { id: "5", date: "2026-04-18 17:10", user: "أحمد منصور", action: "تسجيل دخول", module: "النظام", record: "-", ip: "192.168.1.10" },
  { id: "6", date: "2026-04-18 16:45", user: "محمد ديب", action: "طباعة", module: "فواتير المبيعات", record: "INV-2026-0140", ip: "192.168.1.18" },
];

export const dashboardKpis = {
  sales: { value: 820000, change: 12.5 },
  purchases: { value: 450000, change: -3.2 },
  cash: { value: 365000, change: 8.1 },
  receivables: { value: 253900, change: 5.4 },
  payables: { value: 97500, change: -2.1 },
  inventory: { value: 131100, change: 3.8 },
};

export const revenueChartData = [
  { month: "يناير", revenue: 65000, expenses: 42000 },
  { month: "فبراير", revenue: 72000, expenses: 45000 },
  { month: "مارس", revenue: 85000, expenses: 51000 },
  { month: "أبريل", revenue: 92000, expenses: 48000 },
  { month: "مايو", revenue: 78000, expenses: 52000 },
  { month: "يونيو", revenue: 88000, expenses: 49000 },
];