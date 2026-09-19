import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { PageHeader } from "./PageHeader";
import { TemplateDetailPanel } from "./TemplateDetailPanel";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";

interface OperationalTableTemplateProps {
  title: string;
  badge?: ReactNode;
  toolbar?: ReactNode;
  toolbarActions?: ResponsiveActionItem[];
  filterBar?: ReactNode;
  headerWidgets?: ReactNode;
  tableContent: ReactNode;
  sidePanel?: ReactNode;
  isPanelOpen?: boolean;
  summaryContent?: ReactNode;
  bottomWidgets?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function OperationalTableTemplate({
  title,
  badge,
  toolbar,
  toolbarActions,
  filterBar,
  headerWidgets,
  tableContent,
  sidePanel,
  isPanelOpen = false,
  summaryContent,
  bottomWidgets,
  className,
  children
}: OperationalTableTemplateProps) {
  const { direction } = useLocalization();
  return (
    <div className={cn("flex flex-col h-full w-full bg-background", className)} dir={direction}>
      <PageHeader
        title={title}
        badge={badge}
        actions={toolbar}
        actionItems={toolbarActions}
        pinAction
        pinLabel={title}
      />

      <div className="print-clean-parent relative flex flex-1 overflow-hidden gap-1.5 p-1.5 sm:gap-2 sm:p-2 md:gap-3 md:p-2.5">
        
        {/* Main Column */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden sm:gap-2">
          
          {headerWidgets && (
            <div className="shrink-0">
              {headerWidgets}
            </div>
          )}

          {filterBar && (
            <div className="no-print shrink-0">
              {filterBar}
            </div>
          )}

          <div className="print-clean flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
            <div className="flex-1 overflow-x-auto overflow-y-auto relative">
              {tableContent}
            </div>
          </div>

          {bottomWidgets && (
            <div className="shrink-0">
              {bottomWidgets}
            </div>
          )}

          {summaryContent && (
            <div className="flex shrink-0 items-center justify-between rounded-xl border border-border bg-card px-2.5 py-2 shadow-sm transition-all hover:shadow-md sm:px-3">
              {summaryContent}
            </div>
          )}
        </div>

        {sidePanel && (
          <TemplateDetailPanel isOpen={isPanelOpen}>{sidePanel}</TemplateDetailPanel>
        )}
      </div>
      {children}
    </div>
  );
}
