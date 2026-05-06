import React from "react";
import { cn } from "@shared/lib/utils";

interface DashboardLayoutProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  widgets?: React.ReactNode;
  className?: string;
}

export function DashboardLayout({ header, children, widgets, className }: DashboardLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-slate-50/50 p-4 lg:p-8 space-y-8", className)} dir="rtl">
      {header && (
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {header}
        </header>
      )}

      {widgets && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {widgets}
        </section>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {children}
      </main>
    </div>
  );
}

export function DashboardCard({ 
  title, 
  subtitle, 
  children, 
  actions, 
  className,
  span = 12
}: { 
  title: string; 
  subtitle?: string; 
  children: React.ReactNode; 
  actions?: React.ReactNode;
  className?: string;
  span?: number;
}) {
  return (
    <div className={cn(
      "bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col",
      span === 12 ? "lg:col-span-12" : 
      span === 8 ? "lg:col-span-8" : 
      span === 6 ? "lg:col-span-6" : 
      span === 4 ? "lg:col-span-4" : "lg:col-span-12",
      className
    )}>
      <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="space-y-1">
          <h3 className="font-black text-slate-900 text-lg">{title}</h3>
          {subtitle && <p className="text-xs font-medium text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="p-8 flex-1">
        {children}
      </div>
    </div>
  );
}
