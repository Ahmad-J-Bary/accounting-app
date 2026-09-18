import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { SidebarAddAction } from "@shared/components/SidebarAddAction";
import {
  ResponsiveActions,
  type ResponsiveActionItem,
} from "@widgets/page-header/ResponsiveActions";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  actionItems?: ResponsiveActionItem[];
  pinAction?: boolean;
  pinLabel?: string;
  sticky?: boolean;
  className?: string;
}

export function PageHeader({
  title, subtitle, badge, actions, actionItems,
  pinAction = false, pinLabel,
  sticky = true,
  className,
}: PageHeaderProps) {
  const hasResponsiveActions = Boolean(actionItems?.length);

  return (
    <header
      className={cn(
        "no-print flex flex-col gap-2 px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 bg-background/95 backdrop-blur-sm border-b border-border shrink-0 lg:flex-row lg:items-center lg:justify-between",
        sticky && "sticky top-0 z-20",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <h1 className="text-sm sm:text-base md:text-lg font-bold text-foreground tracking-tight shrink-0">{title}</h1>
        {badge && <div className="shrink-0">{badge}</div>}
        {pinAction && <SidebarAddAction label={pinLabel || title} />}
        {subtitle && (
          <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium hidden sm:inline border-s border-border ps-2 me-1">
            {subtitle}
          </span>
        )}
      </div>

      {(hasResponsiveActions || actions) && (
        <div className="no-print min-w-0 flex-1 flex justify-end">
          {hasResponsiveActions ? (
            <ResponsiveActions actions={actionItems ?? []} className="w-full flex justify-end" />
          ) : (
            <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0 flex-wrap justify-end">{actions}</div>
          )}
        </div>
      )}
    </header>
  );
}
