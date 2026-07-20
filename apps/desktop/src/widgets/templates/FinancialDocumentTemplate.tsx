import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { useSidePanelSettings } from "@shared/hooks";
import { PageHeader } from "./PageHeader";

interface FinancialDocumentTemplateProps {
  title: string;
  subtitle?: string;
  statusBadge?: ReactNode;
  toolbar?: ReactNode;
  headerFields: ReactNode;
  lineItemsGrid: ReactNode;
  summaryPanel: ReactNode;
  sidebar?: ReactNode;
  isSidebarOpen?: boolean;
  footer?: ReactNode;
  className?: string;
}

export function FinancialDocumentTemplate({
  title, subtitle, statusBadge, toolbar, headerFields,
  lineItemsGrid, summaryPanel, sidebar, isSidebarOpen = false, footer, className
}: FinancialDocumentTemplateProps) {
  const { getSidebarWidth } = useSidePanelSettings();

  return (
    <div className={cn("flex flex-col h-full w-full bg-muted/30", className)} dir="rtl">
      <PageHeader title={title} subtitle={subtitle} badge={statusBadge} actions={toolbar} pinAction pinLabel={title} />
      <div className="flex-1 flex overflow-hidden p-1 gap-1.5">
        <div className="flex-1 flex flex-col min-w-0 gap-2 overflow-hidden">
          <div className="bg-card border border-border rounded-lg shadow-sm p-1.5 shrink-0 border-t-2 border-t-primary/5">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-1 auto-rows-min">{headerFields}</div>
          </div>

          <div className="flex-1 flex flex-col bg-card border border-border rounded-lg shadow-sm overflow-hidden min-h-0">
            <div className="flex-1 overflow-auto">{lineItemsGrid}</div>
            {footer && <div className="p-2 border-t border-border bg-muted/20">{footer}</div>}
          </div>

          <div className="shrink-0">{summaryPanel}</div>
        </div>

        {sidebar && (
          <aside className={cn(
            "flex flex-col overflow-hidden transition-all duration-300 shrink-0 rounded-xl border border-border bg-card shadow-lg",
            isSidebarOpen ? "opacity-100" : "w-0 opacity-0 border-none p-0 overflow-hidden"
          )} style={{ width: isSidebarOpen ? getSidebarWidth() : '0px', minWidth: isSidebarOpen ? getSidebarWidth() : '0px' }}>
            <div className="flex-1 overflow-auto">{sidebar}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
