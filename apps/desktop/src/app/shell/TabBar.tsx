import { useTabs } from '@app/providers/TabContext';
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from '@shared/lib/utils';
import { Button } from "@shared/ui/button";
import { useRef } from "react";

export function TabBar() {
  const { tabs, switchTab, closeTab } = useTabs();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const visibleTabs = tabs.filter(t => t.id !== 'main-tab');

  if (visibleTabs.length === 0) return null;

  return (
    <div className="flex items-center bg-white border-b border-slate-200 px-2 h-10 gap-1 overflow-hidden group">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => scroll("right")}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      <div 
        ref={scrollRef}
        className="flex-1 flex items-end h-full gap-1 overflow-x-auto no-scrollbar scroll-smooth"
      >
        {visibleTabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={cn(
              "group/tab relative flex items-center h-[34px] px-4 min-w-[120px] max-w-[200px] text-xs font-medium cursor-pointer transition-all border-t-2 border-transparent rounded-t-md",
              tab.active 
                ? "bg-slate-50 border-blue-600 text-blue-700 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]" 
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            )}
          >
            <span className="truncate flex-1 text-right">{tab.title}</span>
            {tab.closable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={cn(
                  "mr-2 p-0.5 rounded-full hover:bg-slate-200 transition-colors",
                  tab.active ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100"
                )}
              >
                <X className="w-3 h-3" />
              </button>
            )}
            
            {/* Divider for non-active tabs */}
            {!tab.active && (
              <div className="absolute left-0 top-1/4 bottom-1/4 w-[1px] bg-slate-200" />
            )}
          </div>
        ))}
      </div>

      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => scroll("left")}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
    </div>
  );
}
