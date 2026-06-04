import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { useSidebarSettings } from "@shared/hooks/useSidebarSettings";

interface TableStat {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: string;
}

interface OperationalTableTemplateProps {
  /** Page Title */
  title: string;
  /** Main list actions (New, Import, etc) */
  toolbar?: ReactNode;
  /** Stats array to be shown in the filter bar */
  stats?: TableStat[];
  /** Stats cards or charts shown at the top (legacy, avoid using) */
  headerWidgets?: ReactNode;
  /** Filter and search controls */
  filterBar?: ReactNode;
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

/**
 * A master template for operational list/table pages.
 * Supports an optional fly-out side panel for Master-Detail interactions.
 */
export function OperationalTableTemplate({
  title,
  toolbar,
  stats,
  headerWidgets,
  filterBar,
  tableContent,
  sidePanel,
  isPanelOpen = false,
  summaryContent,
  bottomWidgets,
  className,
  children
}: OperationalTableTemplateProps) {
  const { getSidebarWidth, settings } = useSidebarSettings();

  return (
    <div className={cn("flex flex-col h-full w-full bg-[#f8fafc]", className)} dir="rtl">
      {/* 1. Page Header - Optimized for Density */}
      <header className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md shadow-slate-200 shrink-0">
            <span className="text-lg font-black">ERP</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {toolbar}
        </div>
      </header>

      {/* 2. Main Layout Area - High Density Spacing */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        
        {/* Main Column: Widgets + Filters + Table */}
        <div className="flex-1 flex flex-col min-w-0 gap-3 overflow-hidden">
          
          {/* Legacy Header Widgets */}
          {headerWidgets && (
            <div className="shrink-0">
              {headerWidgets}
            </div>
          )}

          {/* Integrated Filter & Stats Bar */}
          {(filterBar || stats) && (
            <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm px-4 py-2 shrink-0 flex items-center justify-between gap-4 transition-all hover:shadow-md">
              <div className="flex-1 min-w-0">
                {filterBar}
              </div>
              
              {stats && stats.length > 0 && (
                <div className="flex items-center gap-6 pr-4 border-r border-slate-100 mr-2">
                  {stats.map((s, i) => (
                    <div key={i} className="flex flex-col items-start gap-0.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{s.label}</span>
                      <div className="flex items-center gap-1.5">
                         {s.icon && <s.icon className={cn("w-3.5 h-3.5", s.color || "text-slate-500")} />}
                         <span className={cn("text-base font-black tabular-nums", s.color || "text-slate-900")}>{s.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Table Container */}
          <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="flex-1 overflow-x-hidden overflow-y-auto relative custom-scrollbar">
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
            <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm px-4 py-2 shrink-0 flex items-center justify-between transition-all hover:shadow-md">
              {summaryContent}
            </div>
          )}
        </div>

        {/* Optional Side Detail Panel */}
        {sidePanel && (
          <aside className={cn(
            "bg-white rounded-xl border border-slate-200/70 shadow-xl flex flex-col overflow-hidden transition-all duration-300 shrink-0",
            isPanelOpen ? "opacity-100" : "w-0 opacity-0 border-none p-0 overflow-hidden"
          )} style={{ width: isPanelOpen ? getSidebarWidth() : '0px', transitionProperty: "width, opacity" }}>
            <div className="flex-1 overflow-auto custom-scrollbar" style={{ minWidth: settings.customWidth + 'px' }}>
              {sidePanel}
            </div>
          </aside>
        )}
      </div>
      {children}
    </div>
  );
}
