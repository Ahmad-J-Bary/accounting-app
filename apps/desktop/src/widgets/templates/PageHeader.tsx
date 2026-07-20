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
        "flex items-center justify-between gap-3 px-4 md:px-6 py-2.5 bg-background/95 backdrop-blur-sm border-b border-border shrink-0",
        sticky && "sticky top-0 z-20",
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-lg font-bold text-foreground tracking-tight shrink-0">{title}</h1>
        {badge && <div className="shrink-0">{badge}</div>}
        {pinAction && <SidebarAddAction label={pinLabel || title} />}
        {subtitle && (
          <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline border-s border-border pr-2 ml-1">
            {subtitle}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
