import { ReactNode } from "react";
import { cn } from '@shared/lib/utils';

interface DocumentShellProps {
  headerContent: ReactNode;
  gridContent: ReactNode;
  totalsContent?: ReactNode;
  actionsContent?: ReactNode;
  title: string;
  badge?: ReactNode;
}

export function DocumentShell({
  headerContent,
  gridContent,
  totalsContent,
  actionsContent,
  title,
  badge,
}: DocumentShellProps) {
  return (
    <div className="flex flex-col h-full w-full bg-slate-50 gap-4" dir="rtl">
      
      {/* Top Action Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-border shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
          {badge && <div>{badge}</div>}
        </div>
        <div className="flex items-center gap-2">
          {actionsContent}
        </div>
      </div>

      {/* Main Document Body */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white rounded-xl border border-border shadow-sm">
        
        {/* Header Data Area (Customer, Date, Ref, etc) */}
        <div className="p-6 border-b border-border bg-slate-50/50 shrink-0">
          {headerContent}
        </div>

        {/* Editable Grid Area */}
        <div className="flex-1 min-h-0 overflow-auto relative">
          {gridContent}
        </div>

        {/* Footer & Totals Area */}
        {totalsContent && (
          <div className="p-6 border-t border-border bg-slate-50 shrink-0">
            {totalsContent}
          </div>
        )}
        
      </div>
    </div>
  );
}
