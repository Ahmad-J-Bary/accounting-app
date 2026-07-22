import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { useSidePanelSettings } from "@shared/hooks";
import { PageHeader } from "./PageHeader";

interface OperationalTableTemplateProps {
  /** Page Title */
  title: string;
  /** Main list actions (New, Import, etc) */
  toolbar?: ReactNode;
  /** Filter bar rendered between title/actions and the table */
  filterBar?: ReactNode;
  /** Stats cards or charts shown at the top (legacy, avoid using) */
  headerWidgets?: ReactNode;
  /** The main data table or list */
  tableContent: ReactNode;
  /** Side panel for details/editing (when a row is selected) */
  sidePanel?: ReactNode;
  /** Whether the side panel is currently open */
  isPanelOpen?: boolean;
  /** Optional bottom summary/stats area */
  summaryContent?: ReactNode;
  /** Optional bottom widgets (e.g. charts, grids) */
  bottomWidgets?: ReactNode;
  /** Custom class */
  className?: string;
  /** Extra content (e.g. Modals, Dialogs) */
  children?: ReactNode;
}

export function OperationalTableTemplate({
  title,
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
  const { getSidebarWidth, settings } = useSidePanelSettings();

  return (
    <div className={cn("flex flex-col h-full w-full bg-muted/30", className)} dir="rtl">
      <PageHeader title={title} actions={toolbar} pinAction pinLabel={title} />

      {/* 2. Main Layout Area */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        
        {/* Main Column */}
        <div className="flex-1 flex flex-col min-w-0 gap-3 overflow-hidden">
          
          {/* Legacy Header Widgets */}
          {headerWidgets && (
            <div className="shrink-0">
              {headerWidgets}
            </div>
          )}

          {/* Filter Bar */}
          {filterBar && (
            <div className="no-print shrink-0">
              {filterBar}
            </div>
          )}

          {/* Table Container */}
          <div className="flex-1 flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="flex-1 overflow-x-hidden overflow-y-auto relative">
              {tableContent}
            </div>
          </div>

          {/* Optional Bottom Widgets */}
          {bottomWidgets && (
            <div className="shrink-0">
              {bottomWidgets}
            </div>
          )}

          {/* Optional Footer Summary */}
          {summaryContent && (
            <div className="bg-card rounded-xl border border-border shadow-sm px-4 py-2 shrink-0 flex items-center justify-between transition-all hover:shadow-md">
              {summaryContent}
            </div>
          )}
        </div>

        {/* Optional Side Detail Panel */}
        {sidePanel && (
          <aside className={cn(
            "bg-card rounded-xl border border-border shadow-xl flex flex-col overflow-hidden transition-all duration-300 shrink-0",
            isPanelOpen ? "opacity-100" : "w-0 opacity-0 border-none p-0 overflow-hidden"
          )} style={{ width: isPanelOpen ? getSidebarWidth() : '0px', transitionProperty: "width, opacity" }}>
            <div className="flex-1 overflow-auto" style={{ minWidth: settings.customWidth + 'px' }}>
              {sidePanel}
            </div>
          </aside>
        )}
      </div>
      {children}
    </div>
  );
}
