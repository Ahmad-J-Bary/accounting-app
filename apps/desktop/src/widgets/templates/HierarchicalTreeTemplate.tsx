import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { useSidePanelSettings } from "@shared/hooks";
import { PageHeader } from "./PageHeader";

interface HierarchicalTreeTemplateProps {
  /** Page Title (e.g., "دليل الحسابات") */
  title: string;
  /** Primary toolbar actions */
  toolbar?: ReactNode;
  /** The tree navigation sidebar content */
  treeSidebar: ReactNode;
  /** The detailed view/editor of the selected node */
  detailContent: ReactNode;
  /** Optional actions rendered in the tree card header next to the title */
  treeHeaderActions?: ReactNode;
  /** Custom class */
  className?: string;
}

/**
 * A master template for hierarchical/tree-based pages.
 * Split view with a permanent tree sidebar (main focus) and a fixed detail
 * panel (secondary focus). Shares the app shell (PageHeader, layout tokens,
 * panel width settings) with OperationalTableTemplate while keeping the
 * tree-specific navigation styling.
 */
export function HierarchicalTreeTemplate({
  title,
  toolbar,
  treeSidebar,
  detailContent,
  treeHeaderActions,
  className,
}: HierarchicalTreeTemplateProps) {
  const { getSidebarWidth } = useSidePanelSettings();

  return (
    <div className={cn("flex flex-col h-full w-full bg-muted/30", className)} dir="rtl">
      <PageHeader title={title} actions={toolbar} pinAction pinLabel={title} />

      {/* Split Content Layout */}
      <div className="flex-1 flex overflow-auto p-4 gap-4">
        {/* Tree Column: Hierarchical Tree Navigation (Main Focus) */}
        <div className="flex-[1.5] min-w-[280px] flex flex-col overflow-hidden">
          <aside className="flex-1 bg-card rounded-xl border border-border shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h2 className="text-sm font-black text-foreground uppercase tracking-wider">شجرة البيانات الهيكلية</h2>
              </div>
              {treeHeaderActions && (
                <div className="flex items-center gap-1">
                  {treeHeaderActions}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto p-3 custom-scrollbar">
              {treeSidebar}
            </div>
          </aside>
        </div>

        {/* Fixed Detail Panel (Secondary Focus) */}
        <aside className="bg-card rounded-xl border border-border shadow-xl flex flex-col overflow-hidden shrink min-w-[380px]" style={{ width: getSidebarWidth() }}>
          <div className="flex-1 overflow-auto custom-scrollbar">
            {detailContent}
          </div>
        </aside>
      </div>
    </div>
  );
}