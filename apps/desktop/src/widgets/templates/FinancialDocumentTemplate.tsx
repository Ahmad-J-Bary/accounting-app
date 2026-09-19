import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { PageHeader } from "./PageHeader";
import { TemplateDetailPanel } from "./TemplateDetailPanel";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";

interface FinancialDocumentTemplateProps {
  title: string;
  subtitle?: string;
  statusBadge?: ReactNode;
  toolbar?: ReactNode;
  toolbarActions?: ResponsiveActionItem[];
  headerFields: ReactNode;
  lineItemsGrid: ReactNode;
  summaryPanel: ReactNode;
  sidebar?: ReactNode;
  isSidebarOpen?: boolean;
  footer?: ReactNode;
  className?: string;
}

export function FinancialDocumentTemplate({
  title, subtitle, statusBadge, toolbar, toolbarActions, headerFields,
  lineItemsGrid, summaryPanel, sidebar, isSidebarOpen = false, footer, className
}: FinancialDocumentTemplateProps) {
  const { direction } = useLocalization();
  return (
    <div className={cn("flex flex-col h-full w-full bg-muted/30", className)} dir={direction}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        badge={statusBadge}
        actions={toolbar}
        actionItems={toolbarActions}
        pinAction
        pinLabel={title}
      />
      <div className="flex flex-1 overflow-hidden gap-1.5 p-1.5 sm:gap-2 sm:p-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden sm:gap-2">
          <div className="shrink-0 rounded-lg border border-border border-t-primary/5 bg-card p-1.5 shadow-sm border-t-2 sm:p-2">
            <div className="grid auto-rows-min grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">{headerFields}</div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex-1 overflow-auto">{lineItemsGrid}</div>
            {footer && <div className="p-1.5 sm:p-2 border-t border-border bg-muted/20">{footer}</div>}
          </div>

          <div className="shrink-0">{summaryPanel}</div>
        </div>

        {sidebar && (
          <TemplateDetailPanel isOpen={isSidebarOpen}>
            {sidebar}
          </TemplateDetailPanel>
        )}
      </div>
    </div>
  );
}
