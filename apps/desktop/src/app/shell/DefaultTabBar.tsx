import { useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useTabs } from "@app/providers/TabContext";
import { useAppearance } from "@shared/hooks/useAppearance";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";

export function DefaultTabBar() {
  const { tabs, switchTab, closeTab, openDashboardTab } = useTabs();
  const { settings } = useAppearance();
  const { t, direction } = useLocalization();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRtl = direction === "rtl";

  const scroll = (logicalDirection: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 200;
    const physicalDirection = isRtl
      ? (logicalDirection === "left" ? "right" : "left")
      : logicalDirection;
    scrollRef.current.scrollBy({
      left: physicalDirection === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const visibleTabs = tabs.filter((tab) => tab.id !== "main-tab");
  if (visibleTabs.length === 0) return null;

  const getTabClassName = (active: boolean) =>
    active
      ? "bg-muted/50 border-primary text-primary shadow-[0_-1px_3px_hsl(var(--primary)/0.05)] rounded-t-md"
      : "text-muted-foreground hover:bg-muted hover:text-foreground rounded-t-md";

  return (
    <div className="group flex h-10 items-center gap-1 overflow-hidden border-b border-border bg-background px-2" data-density={settings.density}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => scroll("right")}
        aria-label={t("workspace.controls.scrollBackward", { namespace: "shell" })}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={openDashboardTab}
        title={t("newTab", { namespace: "shell" })}
        aria-label={t("newTab", { namespace: "shell" })}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <div
        ref={scrollRef}
        className="flex h-full flex-1 items-end gap-1 overflow-x-auto scroll-smooth no-scrollbar"
      >
        {visibleTabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={cn(
              "group/tab relative flex h-9 min-w-[120px] max-w-[220px] cursor-pointer items-center border-t-2 border-transparent px-4 text-xs font-medium transition-all",
              getTabClassName(tab.active),
            )}
          >
            {tab.dirty && <span className="me-2 h-2 w-2 shrink-0 rounded-full bg-warning" />}
            <span className="flex-1 truncate text-end">{tab.title}</span>
            {tab.closable && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
                className={cn(
                  "ms-2 rounded-full p-0.5 transition-colors hover:bg-accent",
                  tab.active ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100",
                )}
                aria-label={t("workspace.controls.closeTab", { namespace: "shell" })}
              >
                <X className="h-3 w-3" />
              </button>
            )}

            {!tab.active && (
              <div className="absolute start-0 top-1/4 bottom-1/4 w-px bg-border" />
            )}
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => scroll("left")}
        aria-label={t("workspace.controls.scrollForward", { namespace: "shell" })}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}
