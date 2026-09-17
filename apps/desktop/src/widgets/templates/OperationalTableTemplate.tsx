import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { PageHeader } from "./PageHeader";
import { TemplateDetailPanel } from "./TemplateDetailPanel";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface OperationalTableTemplateProps {
  title: string;
  badge?: ReactNode;
  toolbar?: ReactNode;
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
    <div className={cn("flex flex-col h-full w-full bg-muted/30", className)} dir={direction}>
      <PageHeader title={title} badge={badge} actions={toolbar} pinAction pinLabel={title} />

      <div className="print-clean-parent flex-1 flex overflow-hidden p-2 sm:p-3 md:p-4 gap-2 sm:gap-3 md:gap-4">
        
        {/* Main Column */}
        <div className="flex-1 flex flex-col min-w-0 gap-2 sm:gap-3 overflow-hidden">
          
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

          <div className="print-clean flex-1 flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all hover:shadow-md">
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
            <div className="bg-card rounded-xl border border-border shadow-sm px-3 sm:px-4 py-2 shrink-0 flex items-center justify-between transition-all hover:shadow-md">
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
