import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import {
  BookOpen, FileBarChart, Scale, TrendingUp, Wallet, Clock,
  Receipt, ShoppingCart, Package, AlertTriangle, Users, Truck
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const reports = [
  { category: "التقارير المحاسبية", items: [
    { name: "ميزان المراجعة", desc: "عرض جميع أرصدة الحسابات", icon: Scale, color: "bg-blue-50 text-blue-600" },
    { name: "دفتر الأستاذ العام", desc: "حركات الحسابات التفصيلية", icon: BookOpen, color: "bg-purple-50 text-purple-600" },
    { name: "قائمة الدخل", desc: "الأرباح والخسائر", icon: TrendingUp, color: "bg-green-50 text-green-600" },
    { name: "الميزانية العمومية", desc: "المركز المالي", icon: FileBarChart, color: "bg-indigo-50 text-indigo-600" },
    { name: "التدفقات النقدية", desc: "حركة النقد", icon: Wallet, color: "bg-teal-50 text-teal-600" },
  ]},
  { category: "تقارير الأعمار", items: [
    { name: "أعمار العملاء", desc: "تحليل ذمم العملاء", icon: Users, color: "bg-amber-50 text-amber-600" },
    { name: "أعمار الموردين", desc: "تحليل ذمم الموردين", icon: Truck, color: "bg-red-50 text-red-600" },
    { name: "الفواتير المتأخرة", desc: "فواتير تجاوزت الاستحقاق", icon: Clock, color: "bg-orange-50 text-orange-600" },
  ]},
  { category: "تقارير المبيعات والمشتريات", items: [
    { name: "تقرير المبيعات", desc: "تحليل المبيعات بالتاريخ والعميل", icon: Receipt, color: "bg-blue-50 text-blue-600" },
    { name: "تقرير المشتريات", desc: "تحليل المشتريات", icon: ShoppingCart, color: "bg-purple-50 text-purple-600" },
  ]},
  { category: "تقارير المخزون", items: [
    { name: "تقرير المخزون", desc: "أرصدة وقيم المخزون", icon: Package, color: "bg-teal-50 text-teal-600" },
    { name: "تقرير التالف", desc: "إحصائيات الهدر", icon: AlertTriangle, color: "bg-red-50 text-red-600" },
  ]},
];

export default function Reports() {
  return (
    <>
      <PageHeader
        title="مركز التقارير"
        subtitle="جميع التقارير المالية والإدارية في مكان واحد"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "التقارير" }]}
      />

      {reports.map((group) => (
        <div key={group.category} className="mb-6">
          <h2 className="text-base font-bold mb-3 text-slate-800">{group.category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {group.items.map((r) => (
              <Link key={r.name} to="#" className="block">
                <Card className="p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", r.color)}>
                    <r.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">{r.name}</h3>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <Card className="p-6 mt-6">
        <h3 className="font-bold text-lg mb-4">ميزان المراجعة - مثال</h3>
        <div className="text-xs text-muted-foreground mb-4">عن الفترة من 2026-01-01 إلى 2026-04-18</div>
        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium">الكود</th>
                <th className="text-right px-4 py-3 font-medium">اسم الحساب</th>
                <th className="text-left px-4 py-3 font-medium">مدين</th>
                <th className="text-left px-4 py-3 font-medium">دائن</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border"><td className="px-4 py-3 tabular-nums">1101</td><td className="px-4 py-3">الصندوق</td><td className="px-4 py-3 text-left tabular-nums">45,000.00</td><td className="px-4 py-3 text-left tabular-nums">0.00</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-3 tabular-nums">1102</td><td className="px-4 py-3">البنك الأهلي</td><td className="px-4 py-3 text-left tabular-nums">320,000.00</td><td className="px-4 py-3 text-left tabular-nums">0.00</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-3 tabular-nums">1103</td><td className="px-4 py-3">العملاء</td><td className="px-4 py-3 text-left tabular-nums">253,900.00</td><td className="px-4 py-3 text-left tabular-nums">0.00</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-3 tabular-nums">2101</td><td className="px-4 py-3">الموردون</td><td className="px-4 py-3 text-left tabular-nums">0.00</td><td className="px-4 py-3 text-left tabular-nums">97,500.00</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-3 tabular-nums">3101</td><td className="px-4 py-3">رأس المال</td><td className="px-4 py-3 text-left tabular-nums">0.00</td><td className="px-4 py-3 text-left tabular-nums">500,000.00</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-3 tabular-nums">4101</td><td className="px-4 py-3">المبيعات</td><td className="px-4 py-3 text-left tabular-nums">0.00</td><td className="px-4 py-3 text-left tabular-nums">820,000.00</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-3 tabular-nums">5101</td><td className="px-4 py-3">تكلفة المبيعات</td><td className="px-4 py-3 text-left tabular-nums">300,000.00</td><td className="px-4 py-3 text-left tabular-nums">0.00</td></tr>
            </tbody>
            <tfoot className="bg-slate-100 font-bold">
              <tr><td colSpan={2} className="px-4 py-3 text-right">الإجمالي</td><td className="px-4 py-3 text-left tabular-nums">1,417,500.00</td><td className="px-4 py-3 text-left tabular-nums">1,417,500.00</td></tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}