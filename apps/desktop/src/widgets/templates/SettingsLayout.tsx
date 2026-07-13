import React from "react";
import { cn } from "@shared/lib/utils";

interface SettingsLayoutProps {
  title: string;
  description?: string;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function SettingsLayout({ title, description, sidebar, children, className }: SettingsLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-slate-50/30 p-4 lg:p-6 space-y-6", className)} dir="rtl">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
          {description && <p className="text-slate-500 font-medium text-base">{description}</p>}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {sidebar && (
          <aside className="lg:col-span-3 sticky top-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
              {sidebar}
            </div>
          </aside>
        )}
        
        <main className={cn(sidebar ? "lg:col-span-9" : "lg:col-span-12", "space-y-4")}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function SettingsSection({ 
  title, 
  description, 
  children, 
  className 
}: { 
  title: string; 
  description?: string; 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden", className)}>
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
        <h3 className="font-bold text-slate-900 text-lg">{title}</h3>
        {description && <p className="text-xs font-medium text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
