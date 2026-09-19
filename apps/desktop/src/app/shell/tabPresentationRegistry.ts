import type { TabStyleMode } from "@shared/types/appearance";

export interface TabPresentationDefinition {
  stripClassName: string;
  tabListClassName: string;
  tabGapClassName: string;
  tabClassName: string;
  activeTabClassName: string;
  inactiveTabClassName: string;
  newTabButtonClassName: string;
  scrollButtonClassName: string;
  overflowButtonClassName: string;
  showIcons: boolean;
  showPinnedIndicator: boolean;
  dirtyIndicator: "dot" | "ring";
  inactiveCloseBehavior: "hidden" | "hover" | "active-or-hover";
  showTabSeparators: boolean;
}

const PRESENTATIONS: Record<TabStyleMode, TabPresentationDefinition> = {
  default: {
    stripClassName:
      "flex min-h-10 items-center gap-1 border-b border-border bg-background px-2 py-1",
    tabListClassName: "flex h-full min-w-full items-end overflow-x-auto no-scrollbar scroll-smooth",
    tabGapClassName: "gap-1",
    tabClassName:
      "relative flex h-8 min-w-[144px] max-w-[240px] items-center gap-2 rounded-t-lg border border-transparent px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    activeTabClassName:
      "border-border border-b-background bg-background text-foreground shadow-sm",
    inactiveTabClassName:
      "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
    newTabButtonClassName:
      "h-8 w-8 rounded-md border border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
    scrollButtonClassName:
      "h-8 w-8 rounded-md border border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
    overflowButtonClassName:
      "h-8 w-8 rounded-md border border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
    showIcons: false,
    showPinnedIndicator: true,
    dirtyIndicator: "dot",
    inactiveCloseBehavior: "active-or-hover",
    showTabSeparators: true,
  },
  browser: {
    stripClassName:
      "flex min-h-12 min-w-0 items-end gap-1.5 bg-transparent px-0 py-0",
    tabListClassName: "flex h-12 min-w-0 items-end overflow-x-auto no-scrollbar scroll-smooth",
    tabGapClassName: "gap-1",
    tabClassName:
      "relative flex h-11 min-w-[168px] max-w-[260px] items-center gap-2 rounded-t-2xl border px-4 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    activeTabClassName:
      "border-border/70 border-b-background bg-background text-foreground shadow-sm",
    inactiveTabClassName:
      "border-transparent bg-background/55 text-muted-foreground hover:bg-background/75 hover:text-foreground",
    newTabButtonClassName:
      "h-10 w-10 shrink-0 rounded-full border border-transparent bg-background/70 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground",
    scrollButtonClassName:
      "h-10 w-10 shrink-0 rounded-full border border-transparent bg-background/70 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground",
    overflowButtonClassName:
      "h-10 w-10 rounded-full border border-transparent bg-background/70 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground",
    showIcons: true,
    showPinnedIndicator: true,
    dirtyIndicator: "dot",
    inactiveCloseBehavior: "hover",
    showTabSeparators: false,
  },
  vscode: {
    stripClassName:
      "flex min-h-9 items-center gap-1 border-b border-sidebar-border bg-sidebar px-2 py-1 text-sidebar-foreground",
    tabListClassName: "flex h-full min-w-full items-stretch overflow-x-auto no-scrollbar scroll-smooth",
    tabGapClassName: "gap-px",
    tabClassName:
      "relative flex h-8 min-w-[132px] max-w-[220px] items-center gap-2 border border-transparent px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
    activeTabClassName:
      "border-sidebar-border bg-background text-foreground shadow-[inset_0_2px_0_hsl(var(--primary))]",
    inactiveTabClassName:
      "bg-sidebar text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
    newTabButtonClassName:
      "h-8 w-8 rounded-md border border-transparent text-sidebar-foreground/75 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground",
    scrollButtonClassName:
      "h-8 w-8 rounded-md border border-transparent text-sidebar-foreground/75 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground",
    overflowButtonClassName:
      "h-8 w-8 rounded-md border border-transparent text-sidebar-foreground/75 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground",
    showIcons: true,
    showPinnedIndicator: false,
    dirtyIndicator: "ring",
    inactiveCloseBehavior: "hover",
    showTabSeparators: false,
  },
};

export function getTabPresentation(mode: TabStyleMode): TabPresentationDefinition {
  return PRESENTATIONS[mode] ?? PRESENTATIONS.default;
}
