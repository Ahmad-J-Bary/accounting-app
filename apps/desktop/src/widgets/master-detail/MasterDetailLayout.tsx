import { ReactNode } from "react";
import { cn } from '@shared/lib/utils';

interface MasterDetailLayoutProps {
  masterContent: ReactNode;
  detailContent: ReactNode;
  isDetailOpen: boolean;
  masterWidthClass?: string;
  detailWidthClass?: string;
}

export function MasterDetailLayout({
  masterContent,
  detailContent,
  isDetailOpen,
  detailWidthClass = "w-[400px] xl:w-[500px]",
}: MasterDetailLayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 gap-4" dir="rtl">
      {/* Master Content (Table/List) */}
      <div 
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out h-full overflow-hidden rounded-xl border border-border bg-white shadow-sm",
          isDetailOpen ? "w-[calc(100%-400px)] xl:w-[calc(100%-500px)]" : "w-full"
        )}
      >
        {masterContent}
      </div>

      {/* Detail Content (Side Panel) */}
      <div 
        className={cn(
          "h-full flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden rounded-xl border border-border bg-white shadow-sm",
          isDetailOpen ? `${detailWidthClass} opacity-100 translate-x-0` : "w-0 opacity-0 -translate-x-8 border-none shadow-none"
        )}
      >
        {isDetailOpen && (
          <div className="flex flex-col h-full w-full">
            {detailContent}
          </div>
        )}
      </div>
    </div>
  );
}
