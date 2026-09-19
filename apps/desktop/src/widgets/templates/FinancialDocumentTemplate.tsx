import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { PageHeader } from "./PageHeader";
import { TemplateDetailPanel } from "./TemplateDetailPanel";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";
import { useUiPreferences } from "@shared/hooks/useUiPreferences";
import {
  getPageTemplateGutterClass,
  getPageTemplateRegionGapClass,
  getTableShellRadiusClass,
} from "@shared/lib/page-template-settings";

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
  const { preferences } = useUiPreferences();
  const pageTemplate = preferences.pageTemplate;
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
      <div className={cn("flex flex-1 overflow-hidden", getPageTemplateGutterClass(pageTemplate))}>
        <div className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", getPageTemplateRegionGapClass(pageTemplate))}>
          <div className={cn("shrink-0 border border-border border-t-2 border-t-primary/5 bg-card p-1.5 shadow-sm sm:p-2", getTableShellRadiusClass(pageTemplate))}>
            <div className="grid auto-rows-min grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">{headerFields}</div>
          </div>

          <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-card shadow-sm", getTableShellRadiusClass(pageTemplate))}>
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
