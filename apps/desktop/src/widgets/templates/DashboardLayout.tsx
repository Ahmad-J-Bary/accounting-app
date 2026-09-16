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
    <div className={cn("min-h-screen bg-muted/30 p-3 sm:p-4 lg:p-8 space-y-5 sm:space-y-8", className)} dir="rtl">
      {header && (
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          {header}
        </header>
      )}

      {widgets && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {widgets}
        </section>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
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
      "bg-card rounded-2xl sm:rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col",
      span === 12 ? "lg:col-span-12" : 
      span === 8 ? "lg:col-span-8" : 
      span === 6 ? "lg:col-span-6" : 
      span === 4 ? "lg:col-span-4" : "lg:col-span-12",
      className
    )}>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 border-b border-border flex items-center justify-between gap-2 bg-card">
        <div className="space-y-1 min-w-0">
          <h3 className="font-black text-foreground text-base sm:text-lg">{title}</h3>
          {subtitle && <p className="text-xs font-medium text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="p-4 sm:p-6 lg:p-8 flex-1">
        {children}
      </div>
    </div>
  );
}
