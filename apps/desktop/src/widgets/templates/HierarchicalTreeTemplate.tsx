import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { PageHeader } from "./PageHeader";
import { TemplateDetailPanel } from "./TemplateDetailPanel";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";

interface HierarchicalTreeTemplateProps {
  title: string;
  badge?: ReactNode;
  toolbar?: ReactNode;
  toolbarActions?: ResponsiveActionItem[];
  treeContent: ReactNode;
  treeHeaderTitle?: string;
  treeHeaderActions?: ReactNode;
  sidePanel?: ReactNode;
  isPanelOpen?: boolean;
  className?: string;
  children?: ReactNode;
  treePresentation?: "default" | "explorer";
}

export function HierarchicalTreeTemplate({
  title,
  badge,
  toolbar,
  toolbarActions,
  treeContent,
  treeHeaderTitle,
  treeHeaderActions,
  sidePanel,
  isPanelOpen = false,
  className,
  children,
  treePresentation = "default",
}: HierarchicalTreeTemplateProps) {
  const { t, direction } = useLocalization();
  const resolvedTreeHeaderTitle = treeHeaderTitle ?? t('labels.hierarchicalTree');
  return (
    <div className={cn("flex h-full w-full flex-col bg-muted/30", className)} dir={direction}>
      <PageHeader
        title={title}
        badge={badge}
        actions={toolbar}
        actionItems={toolbarActions}
        pinAction
        pinLabel={title}
      />

      <div className="flex-1 flex overflow-hidden p-2 sm:p-3 md:p-4 gap-2 sm:gap-3 md:gap-4">
        {/* Tree Column */}
        <div className={cn(
          "flex flex-col overflow-hidden min-w-0",
          sidePanel && isPanelOpen ? "lg:flex-[1.5] lg:min-w-[280px]" : "flex-1",
          sidePanel && isPanelOpen ? "max-lg:hidden" : "",
        )}>
          <aside
            className={cn(
              "flex-1 rounded-xl border shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md",
              treePresentation === "explorer"
                ? "bg-slate-950 text-slate-100 border-slate-800"
                : "bg-card border-border",
            )}
          >
            <div
              className={cn(
                "px-3 sm:px-4 py-2.5 sm:py-3 border-b flex items-center justify-between gap-2 shrink-0",
                treePresentation === "explorer"
                  ? "border-slate-800 bg-slate-900/80"
                  : "border-border bg-muted/30",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <h2
                  className={cn(
                    "text-xs sm:text-sm font-black uppercase tracking-wider truncate",
                    treePresentation === "explorer" ? "text-slate-100" : "text-foreground",
                  )}
                >
                  {resolvedTreeHeaderTitle}
                </h2>
              </div>
              {treeHeaderActions && (
                <div className="flex items-center gap-1 shrink-0">
                  {treeHeaderActions}
                </div>
              )}
            </div>
            <div
              className={cn(
                "flex-1 overflow-auto p-2 sm:p-3 custom-scrollbar",
                treePresentation === "explorer" && "bg-slate-950",
              )}
            >
              {treeContent}
            </div>
          </aside>
        </div>

        {/* Optional Animated Detail Panel */}
        {sidePanel && (
          <TemplateDetailPanel isOpen={isPanelOpen}>{sidePanel}</TemplateDetailPanel>
        )}
      </div>
      {children}
    </div>
  );
}
