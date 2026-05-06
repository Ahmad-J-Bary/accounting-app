import { ReactNode } from "react";
import { cn } from '@shared/lib/utils';

interface TreeDetailLayoutProps {
  treeContent: ReactNode;
  mainContent: ReactNode;
  treeWidthClass?: string;
}

export function TreeDetailLayout({
  treeContent,
  mainContent,
  treeWidthClass = "w-[280px] xl:w-[320px]",
}: TreeDetailLayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 gap-4" dir="rtl">
      {/* Tree Sidebar */}
      <div 
        className={cn(
          "h-full flex flex-col shrink-0 overflow-hidden rounded-xl border border-border bg-white shadow-sm",
          treeWidthClass
        )}
      >
        {treeContent}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {mainContent}
      </div>
    </div>
  );
}
