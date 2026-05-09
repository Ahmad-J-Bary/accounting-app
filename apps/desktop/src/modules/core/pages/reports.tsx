import { useState } from "react";
import { 
  BookOpen, FileBarChart, Scale, TrendingUp, Wallet, Clock, 
  Receipt, ShoppingCart, Package, AlertTriangle, Users, Truck,
  ChevronLeft, Search, Calendar, Filter, Download, FileText
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from '@shared/lib/utils';
import { Card } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";

// Template
import { ReportLayout } from "@widgets/templates/ReportLayout";

const reportGroups = [
  { 
    category: "اليوميات المحاسبية", 
    items: [
      { name: "حركة اليومية العامة", desc: "سجل كامل للقيود اليدوية والتسويات العامة", icon: FileText, color: "text-slate-600", bg: "bg-slate-50", to: "/accounting/journals?type=GeneralJournal" },
      { name: "يومية الصندوق / الخزينة", desc: "تتبع المقبوضات والمدفوعات النقدية والتحويلات", icon: Wallet, color: "text-teal-600", bg: "bg-teal-50", to: "/accounting/journals?type=CashJournal" },
      { name: "يومية المبيعات النقدية", desc: "سجل مبيعات الكاش اليومية وحركة النقدية", icon: Receipt, color: "text-blue-600", bg: "bg-blue-50", to: "/accounting/journals?type=CashSalesJournal" },
      { name: "يومية المبيعات الآجلة", desc: "سجل مبيعات العملاء بالدين وحركة الذمم المدينة", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50", to: "/accounting/journals?type=CreditSalesJournal" },
      { name: "يومية المشتريات", desc: "توثيق فواتير المشتريات وحركات الموردين", icon: ShoppingCart, color: "text-amber-600", bg: "bg-amber-50", to: "/accounting/journals?type=PurchaseJournal" },
      { name: "يومية التكاليف الإضافية", desc: "مصاريف الشحن والتخليص وتكاليف الاستيراد", icon: Truck, color: "text-rose-600", bg: "bg-rose-50", to: "/accounting/journals?type=PurchaseCostsJournal" },
    ]
  },
  { 
    category: "الدفاتر والتقارير المالية", 
    items: [
      { name: "دفتر الأستاذ العام", desc: "كشف حركات الحسابات التفصيلية خلال فترة", icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50", to: "/accounting/reports/ledger" },
      { name: "كشف حركات تفصيلي", desc: "تحليل الحركات المالية لحساب معين بالتفصيل", icon: Clock, color: "text-blue-600", bg: "bg-blue-50", to: "/accounting/reports/movements" },
      { name: "ميزان المراجعة", desc: "عرض جميع أرصدة الحسابات الإجمالية والتفصيلية", icon: Scale, color: "text-amber-600", bg: "bg-amber-50", to: "/accounting/reports/trial-balance" },
      { name: "قائمة الدخل", desc: "ملخص الأرباح والخسائر والنشاط التشغيلي", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", to: "/accounting/reports/income" },
    ]
  },
  { 
    category: "تقارير المخزون", 
    items: [
      { name: "جرد وقيمة المخزون", desc: "تحليل كميات وقيم الأصناف المتوفرة حالياً", icon: Package, color: "text-amber-600", bg: "bg-amber-50", to: "/inventory/reports/valuation" },
      { name: "نواقص المخزون", desc: "تقرير بالأصناف التي وصلت ل حد الطلب", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", to: "/inventory/reports/low-stock" },
    ]
  }
];

export default function Reports() {
  const [search, setSearch] = useState("");

  return (
    <ReportLayout
      title="مركز التقارير"
      subtitle="استعرض وحلل أداء منشأتك من خلال تقارير تفصيلية وشاملة."
      actions={
        <div className="relative w-72">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="بحث عن تقرير..." 
            className="pr-12 h-12 rounded-2xl bg-white border-slate-200 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      }
    >
      <div className="p-10 space-y-12">
        {reportGroups.map((group) => (
          <div key={group.category} className="space-y-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-black text-slate-900">{group.category}</h2>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.items.filter(i => i.name.includes(search)).map((r) => (
                <Link key={r.name} to={r.to} className="group">
                  <div className="h-full p-8 rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 relative overflow-hidden">
                    <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", r.bg, r.color)}>
                      <r.icon className="w-8 h-8" />
                    </div>
                    
                    <h3 className="text-lg font-black text-slate-900 mb-2 group-hover:text-blue-600 transition-colors flex items-center justify-between">
                      {r.name}
                      <ChevronLeft className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
                    </h3>
                    <p className="text-sm font-medium text-slate-400 leading-relaxed">{r.desc}</p>
                    
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
        
        <div className="pt-8 border-t border-slate-100">
          <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md">
                <TrendingUp className="w-4 h-4" /> ميزة قادمة
              </div>
              <h2 className="text-4xl font-black max-w-lg leading-tight">تقارير مخصصة ومحرك بيانات ذكي</h2>
              <p className="text-slate-400 font-medium max-w-md text-lg">قريباً ستتمكن من بناء تقاريرك الخاصة باستخدام السحب والإفلات مع تحليلات بيانية متقدمة.</p>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 h-14 px-8 rounded-2xl font-black shadow-xl shadow-blue-900/20">تفعيل الإشعارات</Button>
            </div>
            
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/10 rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/10 rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/10 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}