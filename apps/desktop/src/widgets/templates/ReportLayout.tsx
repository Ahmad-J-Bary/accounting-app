import { cn } from "@shared/lib/utils";
import { Filter, Printer, Download, Share2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import type { ReactNode } from "react";

interface ReportLayoutProps {
  title: string;
  subtitle?: string;
  filters?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ReportLayout({ title, subtitle, filters, children, actions, className }: ReportLayoutProps) {
  return (
    <div className={cn("min-h-full gap-6 bg-slate-50/50 p-4 sm:p-6 lg:gap-8 lg:p-10 flex flex-col", className)} dir="rtl">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="max-w-3xl text-sm font-medium text-slate-500 sm:text-base">{subtitle}</p>}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {actions && <div className="w-full sm:w-auto">{actions}</div>}
          <div className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto sm:justify-start">
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-50 text-slate-500"><Printer className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-50 text-slate-500"><Download className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-50 text-slate-500"><Share2 className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      {filters && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Filter className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="font-black text-slate-900">تصفية التقرير</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {filters}
          </div>
        </section>
      )}

      <main className="flex flex-1 min-h-[520px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:min-h-[600px]">
        {children}
      </main>
    </div>
  );
}

export function ReportTable({ children }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50/50 sticky top-0 backdrop-blur-sm">
          <tr className="text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
            {children}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {/* Rows passed via fragments in children is not ideal, but we can assume children is the whole content or just head */}
        </tbody>
      </table>
    </div>
  );
}
