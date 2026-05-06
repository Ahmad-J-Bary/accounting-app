import React from "react";
import { cn } from "@shared/lib/utils";
import { Search, Filter, Printer, Download, Share2 } from "lucide-react";
import { Button } from "@shared/ui/button";

interface ReportLayoutProps {
  title: string;
  subtitle?: string;
  filters?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function ReportLayout({ title, subtitle, filters, children, actions, className }: ReportLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-slate-50/50 p-6 lg:p-10 space-y-8", className)} dir="rtl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900">{title}</h1>
          {subtitle && <p className="text-slate-500 font-medium">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <div className="flex bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-50 text-slate-500"><Printer className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-50 text-slate-500"><Download className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-50 text-slate-500"><Share2 className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      {filters && (
        <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Filter className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="font-black text-slate-900">تصفية التقرير</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filters}
          </div>
        </section>
      )}

      <main className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
        {children}
      </main>
    </div>
  );
}

export function ReportTable({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
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
