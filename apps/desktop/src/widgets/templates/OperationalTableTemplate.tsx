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

interface OperationalTableTemplateProps {
  title: string;
  badge?: ReactNode;
  breadcrumbs?: import("./PageHeader").PageHeaderCrumb[];
  subtitle?: string;
  pageContext?: ReactNode;
  pageContextInline?: boolean;
  pageContextSide?: "start" | "end";
  pageHeaderSingleRow?: boolean;
  showPinAction?: boolean;
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
  breadcrumbs,
  subtitle,
  pageContext,
  pageContextInline = false,
  pageContextSide = "start",
  pageHeaderSingleRow = false,
  showPinAction = true,
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
  const { preferences } = useUiPreferences();
  const pageTemplate = preferences.pageTemplate;
  const outerGutterClass = getPageTemplateGutterClass(pageTemplate);
  const regionGapClass = getPageTemplateRegionGapClass(pageTemplate);
  const tableRadiusClass = getTableShellRadiusClass(pageTemplate);
  return (
    <div className={cn("flex flex-col h-full w-full bg-background", className)} dir={direction}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        badge={badge}
        breadcrumbs={breadcrumbs}
        context={pageContext}
        contextInline={pageContextInline}
        contextSide={pageContextSide}
        actions={toolbar}
        actionItems={toolbarActions}
        pinAction={showPinAction}
        pinLabel={title}
        singleRow={pageHeaderSingleRow}
      />

      <div className={cn("print-clean-parent relative flex flex-1 overflow-hidden", outerGutterClass)}>
        
        {/* Main Column */}
        <div className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", regionGapClass)}>
          
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

          <div className={cn("print-clean flex flex-1 flex-col overflow-hidden border border-border bg-card shadow-sm transition-all hover:shadow-md", tableRadiusClass)}>
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
            <div className={cn("flex shrink-0 items-center justify-between border border-border bg-card px-2.5 py-2 shadow-sm transition-all hover:shadow-md sm:px-3", tableRadiusClass)}>
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
