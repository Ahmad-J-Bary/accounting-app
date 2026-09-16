import { useTabs } from '@app/providers/TabContext';
import { X, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from '@shared/lib/utils';
import { Button } from "@shared/ui/button";
import { useRef } from "react";
import { useAppearance } from '@shared/hooks/useAppearance';
import { useLocalization } from '@app/providers/LocalizationProvider';

export function TabBar() {
  const { tabs, switchTab, closeTab, openDashboardTab } = useTabs();
  const { settings } = useAppearance();
  const { t, direction } = useLocalization();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRtl = direction === 'rtl';

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      const physicalDirection = isRtl
        ? (direction === "left" ? "right" : "left")
        : direction;
      scrollRef.current.scrollBy({
        left: physicalDirection === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const visibleTabs = tabs.filter(t => t.id !== 'main-tab');

  if (visibleTabs.length === 0) return null;

  const getTabClassName = (active: boolean) => {
    if (settings.tabStyle === "browser") {
      return active
        ? "bg-background border-border text-foreground shadow-sm rounded-t-xl rounded-b-none"
        : "bg-muted border-border text-muted-foreground hover:bg-accent rounded-t-xl rounded-b-none";
    }

    if (settings.tabStyle === "vscode") {
      return active
        ? "bg-sidebar text-sidebar-foreground border-sidebar-border rounded-none"
        : "bg-sidebar/90 text-sidebar-foreground/80 hover:bg-sidebar rounded-none";
    }

    return active
      ? "bg-muted/50 border-primary text-primary shadow-[0_-1px_3px_hsl(var(--primary)/0.05)] rounded-t-md"
      : "text-muted-foreground hover:bg-muted hover:text-foreground rounded-t-md";
  };

  return (
    <div
      className={cn(
        "flex items-center border-b px-2 h-10 gap-1 overflow-hidden group",
        settings.tabStyle === "vscode" ? "bg-sidebar border-sidebar-border" : "bg-background border-border",
      )}
    >
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => scroll("right")}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={openDashboardTab}
        title={t("newTab", { namespace: "shell",  })}
      >
        <Plus className="w-4 h-4" />
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
              "group/tab relative flex items-center h-9 px-4 min-w-[120px] max-w-[220px] text-xs font-medium cursor-pointer transition-all border-t-2 border-transparent",
              getTabClassName(tab.active)
            )}
          >
            {tab.dirty && <span className="me-2 h-2 w-2 shrink-0 rounded-full bg-warning" />}
            <span className="truncate flex-1 text-end">{tab.title}</span>
            {tab.closable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={cn(
                  "ms-2 p-0.5 rounded-full hover:bg-accent transition-colors",
                  tab.active ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100"
                )}
              >
                <X className="w-3 h-3" />
              </button>
            )}
            
            {/* Divider for non-active tabs */}
            {!tab.active && settings.tabStyle === "default" && (
              <div className="absolute start-0 top-1/4 bottom-1/4 w-[1px] bg-border" />
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
