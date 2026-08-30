import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { PageHeader } from "./PageHeader";
import { TemplateDetailPanel } from "./TemplateDetailPanel";

interface HierarchicalTreeTemplateProps {
  /** Page Title (e.g., "دليل الحسابات") */
  title: string;
  /** Badge rendered after the title in the header */
  badge?: ReactNode;
  /** Primary page actions (New, Edit, Delete, ...) */
  toolbar?: ReactNode;
  /** The tree navigation content (nodes, loaders) */
  treeContent: ReactNode;
  /** Optional title rendered in the tree card header */
  treeHeaderTitle?: string;
  /** Optional actions rendered in the tree card header next to the title */
  treeHeaderActions?: ReactNode;
  /** Side panel content (details/form). Render nothing to keep it closed. */
  sidePanel?: ReactNode;
  /** Whether the side panel is currently open */
  isPanelOpen?: boolean;
  /** Custom class */
  className?: string;
  /** Extra content (e.g. Modals, Dialogs) */
  children?: ReactNode;
}

/**
 * A master template for hierarchical/tree-based pages.
 * Split view with a persistent tree sidebar (main focus) and an optional
 * animated detail panel (secondary focus) that follows the global side-panel
 * width settings through the shared TemplateDetailPanel. Shares the app shell
 * (PageHeader, layout tokens, panel width settings) with
 * OperationalTableTemplate while keeping the tree-specific navigation styling.
 */
export function HierarchicalTreeTemplate({
  title,
  badge,
  toolbar,
  treeContent,
  treeHeaderTitle = "شجرة البيانات الهيكلية",
  treeHeaderActions,
  sidePanel,
  isPanelOpen = false,
  className,
  children,
}: HierarchicalTreeTemplateProps) {
  return (
    <div className={cn("flex flex-col h-full w-full bg-muted/30", className)} dir="rtl">
      <PageHeader title={title} badge={badge} actions={toolbar} pinAction pinLabel={title} />

      {/* Split Content Layout */}
      <div className="flex-1 flex overflow-auto p-4 gap-4">
        {/* Tree Column: Hierarchical Tree Navigation (Main Focus) */}
        <div className="flex-[1.5] min-w-[280px] flex flex-col overflow-hidden">
          <aside className="flex-1 bg-card rounded-xl border border-border shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h2 className="text-sm font-black text-foreground uppercase tracking-wider">{treeHeaderTitle}</h2>
              </div>
              {treeHeaderActions && (
                <div className="flex items-center gap-1">
                  {treeHeaderActions}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto p-3 custom-scrollbar">
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