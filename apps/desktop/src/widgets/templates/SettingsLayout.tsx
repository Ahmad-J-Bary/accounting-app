import React from "react";
import { cn } from "@shared/lib/utils";
import { useIsLaptop, useIsTablet, useIsMobile } from "@shared/hooks/useResponsive";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { ResponsiveActions, type ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";

interface SettingsLayoutProps {
  title: string;
  description?: string;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  actionItems?: ResponsiveActionItem[];
  className?: string;
  /** Whether to show the sidebar (controlled by parent based on responsive state) */
  showSidebar?: boolean;
}

export function SettingsLayout({
  title,
  description,
  sidebar,
  children,
  className,
  actions,
  actionItems,
  showSidebar = true,
}: SettingsLayoutProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isLaptop = useIsLaptop();
  const { direction } = useLocalization();
  const hasResponsiveActions = Boolean(actionItems?.length);

  const showInlineSidebar = showSidebar && sidebar && !isMobile && !isTablet;

  return (
    <div className={cn("min-h-screen bg-muted/30 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6", className)} dir={direction}>
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4 pb-1">
        <div className="space-y-1">
          <h1 className="text-lg sm:text-xl md:text-2xl font-black text-foreground tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground font-medium text-sm sm:text-base">{description}</p>}
        </div>
        {(hasResponsiveActions || actions) && (
          <div className="min-w-0">
            {hasResponsiveActions ? (
              <ResponsiveActions actions={actionItems ?? []} />
            ) : (
              <div className="flex items-center gap-2">{actions}</div>
            )}
          </div>
        )}
      </header>

      <div className={cn(
        "grid gap-4 sm:gap-6 items-start",
        showInlineSidebar ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1"
      )}>
        {showInlineSidebar && (
          <aside className={cn(
            "lg:sticky lg:top-4 order-2 lg:order-1",
            isLaptop ? "lg:col-span-2" : "lg:col-span-3"
          )}>
            <div className={cn(
              "bg-card rounded-2xl border border-border shadow-sm",
              isLaptop ? "p-1.5" : "p-2 sm:p-3"
            )}>
              {sidebar}
            </div>
          </aside>
        )}
        
        <main className={cn(
          showInlineSidebar
            ? (isLaptop ? "lg:col-span-10" : "lg:col-span-9")
            : "lg:col-span-12",
          "space-y-3 sm:space-y-4 order-1",
          showInlineSidebar && "lg:order-2"
        )}>
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
    <div className={cn("bg-card rounded-2xl border border-border shadow-sm overflow-hidden", className)}>
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/30">
        <h3 className="font-bold text-foreground text-base sm:text-lg">{title}</h3>
        {description && <p className="text-xs font-medium text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
}
