import { useMemo, useState } from "react";
import { 
  TrendingUp, ChevronLeft, Search
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from '@shared/lib/utils';
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { useTabs } from "@app/providers/TabContext";
import { reportCatalog } from "@modules/core/lib/reportCatalog";

// Template
import { ReportLayout } from "@widgets/templates/ReportLayout";

export default function Reports() {
  const [search, setSearch] = useState("");
  const { openTab, updateMainTab, activeTabId } = useTabs();
  const normalizedSearch = search.trim().toLowerCase();

  const handleReportClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    report: { name: string; to: string }
  ) => {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey || event.button === 1) {
      openTab({
        id: report.to,
        title: report.name,
        path: report.to,
        closable: true,
      });
      return;
    }

    if (activeTabId === "main-tab") {
      updateMainTab({
        title: report.name,
        path: report.to,
      });
      return;
    }

    openTab({
      id: report.to,
      title: report.name,
      path: report.to,
      closable: true,
    });
  };

  const filteredGroups = useMemo(() => {
    return reportCatalog
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!normalizedSearch) return true;
          const haystack = `${group.category} ${item.name} ${item.desc}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalizedSearch]);

  return (
    <ReportLayout
      title="مركز التقارير"
      subtitle="استعرض وحلل أداء منشأتك من خلال تقارير تفصيلية وشاملة."
      actions={
        <div className="relative w-full sm:w-80">
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
      <div className="space-y-8 p-4 sm:p-6 lg:space-y-12 lg:p-10">
        {filteredGroups.map((group) => (
          <div key={group.category} className="space-y-4 lg:space-y-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <h2 className="text-lg font-black text-slate-900 sm:text-xl">{group.category}</h2>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {group.items.map((r) => (
                <Link
                  key={r.name}
                  to={r.to}
                  className="group"
                  onClick={(event) => handleReportClick(event, r)}
                >
                  <div className="relative h-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl sm:p-6 lg:p-8">
                    <div className={cn("mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 sm:mb-6 sm:h-16 sm:w-16", r.bg, r.color)}>
                      <r.icon className="h-7 w-7 sm:h-8 sm:w-8" />
                    </div>
                    
                    <h3 className="mb-2 flex items-center justify-between gap-3 text-base font-black text-slate-900 transition-colors group-hover:text-blue-600 sm:text-lg">
                      {r.name}
                      <ChevronLeft className="h-5 w-5 shrink-0 opacity-0 transition-all -translate-x-4 group-hover:translate-x-0 group-hover:opacity-100" />
                    </h3>
                    <p className="text-sm font-medium leading-relaxed text-slate-400">{r.desc}</p>
                    
                    <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-slate-50 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center sm:p-16">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
              <Search className="h-8 w-8 text-slate-300" />
            </div>
            <h2 className="text-xl font-black text-slate-900">لا توجد تقارير مطابقة</h2>
            <p className="mt-2 font-medium text-slate-500">جرّب البحث باسم التقرير أو بوصفه أو ضمن فئته.</p>
          </div>
        )}
        
        <div className="border-t border-slate-100 pt-6 sm:pt-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-6 text-white sm:p-8 lg:p-12">
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md">
                <TrendingUp className="w-4 h-4" /> ميزة قادمة
              </div>
              <h2 className="max-w-lg text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">تقارير مخصصة ومحرك بيانات ذكي</h2>
              <p className="max-w-md text-base font-medium text-slate-400 lg:text-lg">قريباً ستتمكن من بناء تقاريرك الخاصة باستخدام السحب والإفلات مع تحليلات بيانية متقدمة.</p>
              <Button size="lg" className="h-12 rounded-2xl bg-blue-600 px-6 font-black shadow-xl shadow-blue-900/20 hover:bg-blue-500 sm:h-14 sm:px-8">تفعيل الإشعارات</Button>
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
