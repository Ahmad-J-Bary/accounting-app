import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookOpen,
  Clock,
  FileText,
  Package,
  Receipt,
  Scale,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

export type ReportCatalogItem = {
  name: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  to: string;
};

export type ReportCatalogGroup = {
  category: string;
  items: ReportCatalogItem[];
};

export const reportCatalog: ReportCatalogGroup[] = [
  {
    category: "اليوميات المحاسبية",
    items: [
      { name: "حركة اليومية العامة", desc: "سجل كامل للقيود اليدوية والتسويات العامة", icon: FileText, color: "text-slate-600", bg: "bg-slate-50", to: "/accounting/journals?type=GeneralJournal" },
      { name: "يومية الصندوق / الخزينة", desc: "تتبع المقبوضات والمدفوعات النقدية والتحويلات", icon: Wallet, color: "text-teal-600", bg: "bg-teal-50", to: "/accounting/journals?type=CashJournal" },
      { name: "يومية المبيعات النقدية", desc: "سجل مبيعات الكاش اليومية وحركة النقدية", icon: Receipt, color: "text-blue-600", bg: "bg-blue-50", to: "/accounting/journals?type=CashSalesJournal" },
      { name: "يومية المبيعات الآجلة", desc: "سجل مبيعات العملاء بالدين وحركة الذمم المدينة", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50", to: "/accounting/journals?type=CreditSalesJournal" },
      { name: "يومية المشتريات", desc: "توثيق فواتير المشتريات وحركات الموردين", icon: ShoppingCart, color: "text-amber-600", bg: "bg-amber-50", to: "/accounting/journals?type=PurchaseJournal" },
      { name: "يومية التكاليف الإضافية", desc: "مصاريف الشحن والتخليص وتكاليف الاستيراد", icon: Truck, color: "text-rose-600", bg: "bg-rose-50", to: "/accounting/journals?type=PurchaseCostsJournal" },
    ],
  },
  {
    category: "الدفاتر والتقارير المالية",
    items: [
      { name: "دفتر الأستاذ العام", desc: "كشف حركات الحسابات التفصيلية خلال فترة", icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50", to: "/accounting/reports/ledger" },
      { name: "كشف حركات تفصيلي", desc: "تحليل الحركات المالية لحساب معين بالتفصيل", icon: Clock, color: "text-blue-600", bg: "bg-blue-50", to: "/accounting/reports/movements" },
      { name: "ميزان المراجعة", desc: "عرض جميع أرصدة الحسابات الإجمالية والتفصيلية", icon: Scale, color: "text-amber-600", bg: "bg-amber-50", to: "/accounting/reports/trial-balance" },
      { name: "قائمة الدخل", desc: "ملخص الأرباح والخسائر والنشاط التشغيلي", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", to: "/accounting/reports/income" },
    ],
  },
  {
    category: "تقارير المخزون",
    items: [
      { name: "جرد وقيمة المخزون", desc: "تحليل كميات وقيم الأصناف المتوفرة حالياً", icon: Package, color: "text-amber-600", bg: "bg-amber-50", to: "/inventory/reports/valuation" },
      { name: "نواقص المخزون", desc: "تقرير بالأصناف التي وصلت ل حد الطلب", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", to: "/inventory/reports/low-stock" },
    ],
  },
];
