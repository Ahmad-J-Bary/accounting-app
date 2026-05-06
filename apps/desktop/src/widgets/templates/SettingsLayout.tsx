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

export function SettingsLayout({ title, description, sidebar, children, actions, className }: SettingsLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-slate-50/30 p-6 lg:p-10 space-y-10", className)} dir="rtl">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{title}</h1>
          {description && <p className="text-slate-500 font-medium text-lg">{description}</p>}
        </div>
        {actions && <div className="flex gap-3">{actions}</div>}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {sidebar && (
          <aside className="lg:col-span-3 space-y-2">
            {sidebar}
          </aside>
        )}
        
        <main className={cn(sidebar ? "lg:col-span-9" : "lg:col-span-12", "space-y-8")}>
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
    <div className={cn("bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden", className)}>
      <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/30">
        <h3 className="font-black text-slate-900 text-xl">{title}</h3>
        {description && <p className="text-sm font-medium text-slate-400 mt-1">{description}</p>}
      </div>
      <div className="p-10">
        {children}
      </div>
    </div>
  );
}
