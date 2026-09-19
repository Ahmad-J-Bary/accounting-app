import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { PageHeader } from "./PageHeader";
import { TemplateDetailPanel } from "./TemplateDetailPanel";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";
import { useUiPreferences } from "@shared/hooks/useUiPreferences";
import {
  getPageTemplateGutterClass,
  getTableShellRadiusClass,
} from "@shared/lib/page-template-settings";

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
  children = "default",
}: HierarchicalTreeTemplateProps) {
  const { t, direction } = useLocalization();
  const { preferences } = useUiPreferences();
  const resolvedTreeHeaderTitle = treeHeaderTitle ?? t('labels.hierarchicalTree');
  const pageTemplate = preferences.pageTemplate;
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

      <div className={cn("flex flex-1 overflow-hidden", getPageTemplateGutterClass(pageTemplate))}>
        {/* Tree Column */}
        <div className={cn(
          "flex flex-col overflow-hidden min-w-0",
          sidePanel && isPanelOpen ? "lg:flex-[1.5] lg:min-w-[280px]" : "flex-1",
          sidePanel && isPanelOpen ? "max-lg:hidden" : "",
        )}>
          <aside
            className={cn("flex flex-1 flex-col overflow-hidden border border-border bg-card shadow-sm transition-all hover:shadow-md", getTableShellRadiusClass(pageTemplate))}
          >
            <div
              className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-2.5 py-2.5 sm:px-3 sm:py-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <h2
                  className="text-xs sm:text-sm font-black uppercase tracking-wider truncate text-foreground"
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
              className="custom-scrollbar flex-1 overflow-auto p-1.5 sm:p-2"
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
