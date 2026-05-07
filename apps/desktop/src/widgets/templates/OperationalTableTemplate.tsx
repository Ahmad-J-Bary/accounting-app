import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";

interface OperationalTableTemplateProps {
  /** Page Title */
  title: string;
  /** Main list actions (New, Import, etc) */
  toolbar?: ReactNode;
  /** Stats cards or charts shown at the top */
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
  return (
    <div className={cn("flex flex-col h-full w-full bg-[#f8fafc]", className)} dir="rtl">
      {/* 1. Page Header */}
      <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.03)] shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-5">
           <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200 shrink-0">
            <span className="text-xl font-black">ERP</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
            <p className="text-xs text-slate-400 font-medium mt-1">إدارة العمليات والبيانات الرئيسية</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {toolbar}
        </div>
      </header>

      {/* 2. Main Layout Area */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* Main Column: Widgets + Filters + Table */}
        <div className="flex-1 flex flex-col min-w-0 gap-4 overflow-hidden">
          
          {/* Header Widgets (Stats/Charts) */}
          {headerWidgets && (
            <div className="shrink-0">
              {headerWidgets}
            </div>
          )}

          {/* Filter Bar */}
          {filterBar && (
            <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm px-5 py-3 shrink-0 transition-all hover:shadow-md">
              {filterBar}
            </div>
          )}

          {/* Table Container */}
          <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="flex-1 overflow-auto relative custom-scrollbar">
              {tableContent}
            </div>
          </div>

          {/* Optional Bottom Widgets (Charts/Grids) */}
          {bottomWidgets && (
            <div className="shrink-0">
              {bottomWidgets}
            </div>
          )}

          {/* Optional Footer Summary (Pagination, Totals) */}
          {summaryContent && (
            <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm px-5 py-3 shrink-0 flex items-center justify-between transition-all hover:shadow-md">
              {summaryContent}
            </div>
          )}
        </div>

        {/* Optional Side Detail Panel */}
        {sidePanel && (
          <aside className={cn(
            "bg-white rounded-xl border border-slate-200/70 shadow-xl flex flex-col overflow-hidden transition-all duration-300 shrink-0",
            isPanelOpen ? "w-[500px] opacity-100" : "w-0 opacity-0 border-none p-0 overflow-hidden"
          )}>
            <div className="flex-1 overflow-auto min-w-[500px] custom-scrollbar">
              {sidePanel}
            </div>
          </aside>
        )}
      </div>
      {children}
    </div>
  );
}
