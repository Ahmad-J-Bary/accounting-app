import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookOpen,
  Package,
  Scale,
  TrendingUp,
  Users,
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
    category: "الدفاتر والتقارير المالية",
    items: [
      { name: "دفتر الأستاذ العام", desc: "كشف حركات الحسابات التفصيلية خلال فترة", icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50", to: "/accounting/reports/ledger" },
      { name: "ميزان المراجعة", desc: "عرض جميع أرصدة الحسابات الإجمالية والتفصيلية", icon: Scale, color: "text-amber-600", bg: "bg-amber-50", to: "/accounting/reports/trial-balance" },
      { name: "قائمة الدخل", desc: "ملخص الأرباح والخسائر والنشاط التشغيلي", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", to: "/accounting/reports/income" },
      { name: "الميزانية العمومية", desc: "قائمة المركز المالي (الأصول = الخصوم + حقوق الملكية)", icon: Scale, color: "text-indigo-600", bg: "bg-indigo-50", to: "/accounting/reports/balance-sheet" },
      { name: "الشركاء وتقاسم الأرباح", desc: "توزيع الأرباح والرصيد العام للشركاء", icon: Users, color: "text-violet-600", bg: "bg-violet-50", to: "/accounting/reports/partner-profit-share" },
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
