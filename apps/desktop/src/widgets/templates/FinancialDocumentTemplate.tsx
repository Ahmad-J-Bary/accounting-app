import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";

interface FinancialDocumentTemplateProps {
  title: string;
  subtitle?: string;
  statusBadge?: ReactNode;
  toolbar?: ReactNode;
  headerFields: ReactNode;
  lineItemsGrid: ReactNode;
  summaryPanel: ReactNode;
  sidebar?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function FinancialDocumentTemplate({
  title, subtitle, statusBadge, toolbar, headerFields,
  lineItemsGrid, summaryPanel, sidebar, footer, className
}: FinancialDocumentTemplateProps) {
  return (
    <div className={cn("flex flex-col h-full w-full bg-muted/30", className)} dir="rtl">
      <header className="flex items-center justify-between px-4 md:px-6 py-3 bg-background border-b border-border shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-foreground tracking-tight">{title}</h1>
              {statusBadge}
            </div>
            {subtitle && <p className="text-[11px] text-muted-foreground font-medium">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">{toolbar}</div>
      </header>

      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        <div className="flex-1 flex flex-col min-w-0 gap-2 overflow-hidden">
          <div className="bg-card border border-border rounded-lg shadow-sm p-2 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">{headerFields}</div>
          </div>

          <div className="flex-1 flex flex-col bg-card border border-border rounded-lg shadow-sm overflow-hidden min-h-0">
            <div className="flex-1 overflow-auto">{lineItemsGrid}</div>
            {footer && <div className="p-2 border-t border-border bg-muted/20">{footer}</div>}
          </div>

          <div className="shrink-0">{summaryPanel}</div>
        </div>

        {sidebar && (
          <aside className="w-64 flex flex-col gap-2 shrink-0 overflow-auto">{sidebar}</aside>
        )}
      </div>
    </div>
  );
}
