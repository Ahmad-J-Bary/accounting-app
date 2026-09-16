import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { SidebarAddAction } from "@shared/components/SidebarAddAction";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  pinAction?: boolean;
  pinLabel?: string;
  sticky?: boolean;
  className?: string;
}

export function PageHeader({
  title, subtitle, badge, actions,
  pinAction = false, pinLabel,
  sticky = true,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 bg-background/95 backdrop-blur-sm border-b border-border shrink-0",
        sticky && "sticky top-0 z-20",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <h1 className="text-sm sm:text-base md:text-lg font-bold text-foreground tracking-tight shrink-0">{title}</h1>
        {badge && <div className="shrink-0">{badge}</div>}
        {pinAction && <SidebarAddAction label={pinLabel || title} />}
        {subtitle && (
          <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium hidden sm:inline border-s border-border ps-2 me-1">
            {subtitle}
          </span>
        )}
      </div>
      {actions && <div className="no-print flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0 flex-wrap">{actions}</div>}
    </header>
  );
}
