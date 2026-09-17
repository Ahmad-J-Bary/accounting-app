import React from "react";
import { cn } from "@shared/lib/utils";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { ResponsiveActions, type ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";

interface DashboardLayoutProps {
  header?: React.ReactNode;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionItems?: ResponsiveActionItem[];
  controls?: React.ReactNode;
  children: React.ReactNode;
  widgets?: React.ReactNode;
  className?: string;
}

export function DashboardLayout({
  header,
  title,
  description,
  icon,
  actionItems,
  controls,
  children,
  widgets,
  className,
}: DashboardLayoutProps) {
  const { direction } = useLocalization();
  const hasStructuredHeader = Boolean(title || description || icon || controls || actionItems?.length);

  return (
    <div className={cn("min-h-screen bg-muted/30 p-3 sm:p-4 lg:p-8 space-y-5 sm:space-y-8", className)} dir={direction}>
      {hasStructuredHeader ? (
        <header className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {icon ? (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
                {icon}
              </div>
            ) : null}
            <div className="min-w-0 space-y-1">
              {title ? <h1 className="text-3xl font-black text-foreground">{title}</h1> : null}
              {description ? <p className="font-medium text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-stretch gap-3 lg:items-end">
            {controls}
            {actionItems?.length ? <ResponsiveActions actions={actionItems} /> : null}
          </div>
        </header>
      ) : header ? (
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          {header}
        </header>
      ) : null}

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
  actionItems,
  className,
  span = 12
}: { 
  title: string; 
  subtitle?: string; 
  children: React.ReactNode; 
  actions?: React.ReactNode;
  actionItems?: ResponsiveActionItem[];
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
        {actionItems?.length ? (
          <div className="min-w-0 shrink-0">
            <ResponsiveActions actions={actionItems} />
          </div>
        ) : actions ? <div className="flex gap-2 shrink-0">{actions}</div> : null}
      </div>
      <div className="p-4 sm:p-6 lg:p-8 flex-1">
        {children}
      </div>
    </div>
  );
}
