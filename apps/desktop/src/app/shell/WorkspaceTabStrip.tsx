import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  MoreHorizontal,
  Pin,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@shared/ui/context-menu";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { Tab } from "@shared/types/tabs";
import type { TabStyleMode } from "@shared/types/appearance";
import { getTabPresentation } from "./tabPresentationRegistry";
import { ICON_MAP } from "./sidebarConfig";
import { findRouteByPath } from "./routeRegistry";

interface WorkspaceTabStripProps {
  tabs: Tab[];
  tabStyle: TabStyleMode;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
  onCloseOthers?: (id: string) => void;
  onCloseToRight?: (id: string) => void;
  onCloseToLeft?: (id: string) => void;
  onCloseAll?: () => void;
  onReopenLastClosed?: () => void;
  onDuplicate?: (id: string) => void;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  className?: string;
  alwaysVisible?: boolean;
}

function normalizeTabPath(path: string) {
  return path.split("?")[0];
}

export function WorkspaceTabStrip({
  tabs,
  tabStyle,
  onActivate,
  onClose,
  onNewTab,
  onCloseOthers,
  onCloseToRight,
  onCloseToLeft,
  onCloseAll,
  onReopenLastClosed,
  onDuplicate,
  onPin,
  onUnpin,
  className,
  alwaysVisible = false,
}: WorkspaceTabStripProps) {
  const { t, direction } = useLocalization();
  const presentation = getTabPresentation(tabStyle);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollBackward, setCanScrollBackward] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const isRtl = direction === "rtl";
  const isBrowserPresentation = tabStyle === "browser";

  const visibleTabs = useMemo(() => tabs, [tabs]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateScrollState = () => {
      const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
      const current = Math.abs(element.scrollLeft);
      setCanScrollBackward(current > 4);
      setCanScrollForward(current < maxScroll - 4);
    };

    updateScrollState();
    element.addEventListener("scroll", updateScrollState);
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [visibleTabs.length, tabStyle]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const activeTab = element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    activeTab?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [tabs]);

  if (!alwaysVisible && visibleTabs.length === 0) {
    return null;
  }

  const scroll = (logicalDirection: "backward" | "forward") => {
    if (!scrollRef.current) return;
    const scrollAmount = 220;
    const shouldMoveLeft = isRtl ? logicalDirection === "forward" : logicalDirection === "backward";
    scrollRef.current.scrollBy({
      left: shouldMoveLeft ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const resolveIcon = (tab: Tab) => {
    const iconName = tab.icon || findRouteByPath(normalizeTabPath(tab.path))?.icon;
    return iconName ? ICON_MAP[iconName] : undefined;
  };

  const getCloseVisibilityClass = (tab: Tab) => {
    if (!tab.closable) return "hidden";
    if (presentation.inactiveCloseBehavior === "hover") {
      return "opacity-0 group-hover/tab:opacity-100 focus-within:opacity-100";
    }
    if (presentation.inactiveCloseBehavior === "active-or-hover") {
      return tab.active ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100 focus-within:opacity-100";
    }
    return "opacity-100";
  };

  const renderDirtyIndicator = (tab: Tab) => {
    if (!tab.dirty) return null;
    if (presentation.dirtyIndicator === "ring") {
      return <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-current bg-transparent" aria-hidden="true" />;
    }
    return <Circle className="h-2.5 w-2.5 shrink-0 fill-current text-warning" aria-hidden="true" />;
  };

  return (
    <TooltipProvider delayDuration={250}>
      <div className={cn(presentation.stripClassName, className)} data-tab-style={tabStyle}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          presentation.scrollButtonClassName,
          isBrowserPresentation && "order-3",
        )}
        onClick={() => scroll("backward")}
        disabled={!canScrollBackward}
        aria-label={t("workspace.controls.scrollBackward", { namespace: "shell" })}
        title={t("workspace.controls.scrollBackward", { namespace: "shell" })}
      >
        {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          presentation.newTabButtonClassName,
          isBrowserPresentation && "order-2",
        )}
        onClick={onNewTab}
        aria-label={t("workspace.controls.newTab", { namespace: "shell" })}
        title={t("workspace.controls.newTab", { namespace: "shell" })}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-x-auto no-scrollbar",
          presentation.tabListClassName,
          presentation.tabGapClassName,
          isBrowserPresentation && "order-1",
        )}
        role="tablist"
        aria-orientation="horizontal"
      >
        {visibleTabs.map((tab, index) => {
          const Icon = resolveIcon(tab);
          const canClose = Boolean(tab.closable);
          const canCloseOthers = Boolean(onCloseOthers);
          const canCloseToRight = Boolean(onCloseToRight && index < visibleTabs.length - 1);
          const canCloseToLeft = Boolean(onCloseToLeft && index > 0);

          return (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <div
                  role="tab"
                  tabIndex={0}
                  aria-selected={tab.active}
                  aria-current={tab.active ? "page" : undefined}
                  aria-label={t("workspace.menu.switchTo", {
                    namespace: "shell",
                    vars: { title: tab.title },
                  })}
                  onClick={() => onActivate(tab.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onActivate(tab.id);
                    }
                  }}
                  className={cn(
                    "group/tab shrink-0",
                    presentation.tabClassName,
                    tab.active ? presentation.activeTabClassName : presentation.inactiveTabClassName,
                  )}
                  title={tab.title}
                >
                  {presentation.showTabSeparators && !tab.active && index > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute start-0 top-1/4 h-1/2 w-px bg-border"
                    />
                  )}

                  {presentation.showIcons && Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}

                  {presentation.showPinnedIndicator && tab.pinned && (
                    <Pin className="h-3 w-3 shrink-0 text-primary" aria-label={t("workspace.controls.pinned", { namespace: "shell" })} />
                  )}

                  {renderDirtyIndicator(tab)}
                  {tab.dirty && <span className="sr-only">{t("workspace.controls.dirty", { namespace: "shell" })}</span>}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn("min-w-0 flex-1 truncate text-start", tab.active ? "text-foreground" : "")}>
                        {tab.title}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{tab.title}</TooltipContent>
                  </Tooltip>

                  {canClose && (
                    <button
                      type="button"
                      aria-label={t("workspace.controls.closeTab", { namespace: "shell" })}
                      title={t("workspace.controls.closeTab", { namespace: "shell" })}
                      className={cn(
                        "ms-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        getCloseVisibilityClass(tab),
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        onClose(tab.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-60">
                <ContextMenuLabel>{t("workspace.menu.tabActions", { namespace: "shell" })}</ContextMenuLabel>
                <ContextMenuItem onClick={() => onActivate(tab.id)}>
                  {t("workspace.menu.activate", { namespace: "shell" })}
                </ContextMenuItem>
                {canClose && (
                  <ContextMenuItem onClick={() => onClose(tab.id)}>
                    {t("workspace.menu.close", { namespace: "shell" })}
                    <ContextMenuShortcut>Ctrl+W</ContextMenuShortcut>
                  </ContextMenuItem>
                )}
                {canCloseOthers && (
                  <ContextMenuItem onClick={() => onCloseOthers?.(tab.id)}>
                    {t("workspace.menu.closeOthers", { namespace: "shell" })}
                  </ContextMenuItem>
                )}
                {canCloseToRight && (
                  <ContextMenuItem onClick={() => onCloseToRight?.(tab.id)}>
                    {t("workspace.menu.closeToRight", { namespace: "shell" })}
                  </ContextMenuItem>
                )}
                {canCloseToLeft && (
                  <ContextMenuItem onClick={() => onCloseToLeft?.(tab.id)}>
                    {t("workspace.menu.closeToLeft", { namespace: "shell" })}
                  </ContextMenuItem>
                )}
                {onCloseAll && (
                  <ContextMenuItem onClick={() => onCloseAll()}>
                    {t("workspace.menu.closeAll", { namespace: "shell" })}
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                {onReopenLastClosed && (
                  <ContextMenuItem onClick={() => onReopenLastClosed()}>
                    {t("workspace.menu.reopenLastClosed", { namespace: "shell" })}
                  </ContextMenuItem>
                )}
                {onDuplicate && (
                  <ContextMenuItem onClick={() => onDuplicate(tab.id)}>
                    {t("workspace.menu.duplicate", { namespace: "shell" })}
                  </ContextMenuItem>
                )}
                {(onPin || onUnpin) && (
                  <ContextMenuItem onClick={() => (tab.pinned ? onUnpin?.(tab.id) : onPin?.(tab.id))}>
                    {tab.pinned
                      ? t("workspace.menu.unpin", { namespace: "shell" })
                      : t("workspace.menu.pin", { namespace: "shell" })}
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>

      {!isBrowserPresentation && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={presentation.overflowButtonClassName}
              aria-label={t("workspace.controls.moreTabs", { namespace: "shell" })}
              title={t("workspace.controls.moreTabs", { namespace: "shell" })}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRtl ? "start" : "end"} className="w-72">
            {visibleTabs.map((tab) => {
              const Icon = resolveIcon(tab);
              return (
                <DropdownMenuItem key={tab.id} onClick={() => onActivate(tab.id)} className="gap-2">
                  {presentation.showIcons && Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                  {tab.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                  {tab.dirty && renderDirtyIndicator(tab)}
                  <span className="min-w-0 flex-1 truncate">{tab.title}</span>
                  {tab.closable && (
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        onClose(tab.id);
                      }}
                      aria-label={t("workspace.controls.closeTab", { namespace: "shell" })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </DropdownMenuItem>
              );
            })}
            {visibleTabs.length > 0 && <DropdownMenuSeparator />}
            {onReopenLastClosed && (
              <DropdownMenuItem onClick={() => onReopenLastClosed()} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {t("workspace.menu.reopenLastClosed", { namespace: "shell" })}
              </DropdownMenuItem>
            )}
            {onCloseAll && (
              <DropdownMenuItem onClick={() => onCloseAll()} className="gap-2">
                <X className="h-4 w-4" />
                {t("workspace.menu.closeAll", { namespace: "shell" })}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          presentation.scrollButtonClassName,
          isBrowserPresentation && "order-4",
        )}
        onClick={() => scroll("forward")}
        disabled={!canScrollForward}
        aria-label={t("workspace.controls.scrollForward", { namespace: "shell" })}
        title={t("workspace.controls.scrollForward", { namespace: "shell" })}
      >
        {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
      </div>
    </TooltipProvider>
  );
}
