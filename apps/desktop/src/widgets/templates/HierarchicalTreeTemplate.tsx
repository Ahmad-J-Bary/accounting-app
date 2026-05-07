import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";

interface HierarchicalTreeTemplateProps {
  /** Page Title (e.g., "دليل الحسابات") */
  title: string;
  /** Primary toolbar actions */
  toolbar?: ReactNode;
  /** The tree navigation sidebar content */
  treeSidebar: ReactNode;
  /** The detailed view/editor of the selected node */
  detailContent: ReactNode;
  /** Filter and stats bar below header */
  filterBar?: ReactNode;
  /** Optional secondary info or stats */
  extraContent?: ReactNode;
  /** Custom class */
  className?: string;
}

/**
 * A master template for hierarchical/tree-based pages.
 * Split view with a permanent tree sidebar on the right and details on the left.
 */
export function HierarchicalTreeTemplate({
  title,
  toolbar,
  treeSidebar,
  detailContent,
  filterBar,
  extraContent,
  className
}: HierarchicalTreeTemplateProps) {
  return (
    <div className={cn("flex flex-col h-full w-full bg-[#f8fafc]", className)} dir="rtl">
      {/* 1. Header Area */}
      <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.03)] shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-5">
           <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200 shrink-0">
            <span className="text-xl font-black">ERP</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
            <p className="text-xs text-slate-400 font-medium mt-1">إدارة البيانات الهيكلية والترتيب الهرمي</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {toolbar}
        </div>
      </header>

      {/* Filter / Stats Bar */}
      {filterBar && (
        <div className="bg-white/60 backdrop-blur-md px-8 py-3 border-b border-slate-200/60 shadow-sm shrink-0 flex items-center justify-between z-10">
          {filterBar}
        </div>
      )}

      {/* 2. Split Content Layout */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* Right Column: Hierarchical Tree Navigation (Main Focus) */}
        <div className="flex-[1.5] flex flex-col min-w-0 overflow-hidden">
          <aside className="flex-1 bg-white rounded-2xl border border-slate-200/70 shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">شجرة البيانات الهيكلية</h2>
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            </div>
            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
              {treeSidebar}
            </div>
          </aside>
        </div>

        {/* Left Column: Detailed View (Secondary Focus) */}
        <aside className="w-[480px] flex flex-col shrink-0 gap-6 overflow-hidden">
          
          {/* Node Details Card */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden transition-all hover:shadow-md relative">
            <div className="absolute top-0 left-0 w-32 h-32 bg-slate-50 rounded-br-full opacity-30 -ml-16 -mt-16" />
            <div className="flex-1 overflow-auto p-5 relative z-10 custom-scrollbar">
              {detailContent}
            </div>
          </div>
        </aside>
      </div>
    </div>

  );
}
