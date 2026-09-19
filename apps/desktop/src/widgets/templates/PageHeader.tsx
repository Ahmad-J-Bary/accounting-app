import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { SidebarAddAction } from "@shared/components/SidebarAddAction";
import { useLocalization } from "@app/providers/LocalizationProvider";
import {
  ResponsiveActions,
  type ResponsiveActionItem,
} from "@widgets/page-header/ResponsiveActions";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useUiPreferences } from "@shared/hooks/useUiPreferences";
import { getPageHeaderShellClasses } from "@shared/lib/page-template-settings";

export interface PageHeaderCrumb {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  breadcrumbs?: PageHeaderCrumb[];
  context?: ReactNode;
  contextInline?: boolean;
  contextSide?: "start" | "end";
  actions?: ReactNode;
  actionItems?: ResponsiveActionItem[];
  pinAction?: boolean;
  pinLabel?: string;
  singleRow?: boolean;
  sticky?: boolean;
  className?: string;
}

export function PageHeader({
  title, subtitle, badge, breadcrumbs, context, actions, actionItems,
  contextInline = false,
  contextSide = "start",
  pinAction = false, pinLabel,
  singleRow = false,
  sticky = true,
  className,
}: PageHeaderProps) {
  const { direction } = useLocalization();
  const { preferences } = useUiPreferences();
  const settings = preferences.pageHeader;
  const hasResponsiveActions = Boolean(actionItems?.length);
  const isRTL = direction === "rtl";
  const showBreadcrumbs = settings.showBreadcrumbs && breadcrumbs && breadcrumbs.length > 0;
  const showSubtitle = settings.showSubtitle && subtitle;
  const titleRowDirection = settings.actionAlignment === "split" ? "lg:flex-row lg:items-start lg:justify-between" : "lg:flex-row lg:items-center lg:justify-between";
  const renderInlineContext = Boolean(context && contextInline);
  const hasHeaderActions = Boolean(hasResponsiveActions || actions);
  const renderContextAtEnd = renderInlineContext && singleRow && contextSide === "end";
  const leftRailClass = renderContextAtEnd
    ? "min-w-0 flex-1"
    : renderInlineContext
    ? "flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "min-w-0 flex-1 space-y-1";

  return (
    <header
      className={cn(
        getPageHeaderShellClasses(settings),
        "flex flex-col gap-2",
        sticky && settings.sticky && "sticky top-0 z-20",
        className,
      )}
    >
      {showBreadcrumbs && (
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <div key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {crumb.to ? (
                <Link to={crumb.to} className="transition-colors hover:text-primary">
                  {crumb.label}
                </Link>
              ) : crumb.onClick ? (
                <button type="button" onClick={crumb.onClick} className="transition-colors hover:text-primary">
                  {crumb.label}
                </button>
              ) : (
                <span>{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 &&
                (isRTL ? (
                  <ChevronLeft className="h-3 w-3 text-muted-foreground/60" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                ))}
            </div>
          ))}
        </nav>
      )}

      <div className={cn(singleRow ? "flex min-w-0 items-center justify-between gap-2 overflow-hidden" : "flex min-w-0 flex-col gap-2", !singleRow && titleRowDirection)}>
        <div className={leftRailClass}>
          <div className={cn("flex min-w-0 items-center gap-1.5 sm:gap-2", renderInlineContext ? "shrink-0" : "flex-wrap")}>
            <h1 className={cn("text-sm font-bold tracking-tight text-foreground sm:text-base md:text-lg", renderInlineContext ? "shrink-0 truncate" : "truncate")}>{title}</h1>
            {settings.badgePlacement === "inline" && badge && <div className="shrink-0">{badge}</div>}
            {pinAction && <SidebarAddAction label={pinLabel || title} />}
          </div>
          {!renderInlineContext && settings.badgePlacement === "stacked" && badge && <div>{badge}</div>}
          {!renderInlineContext && showSubtitle && (
            <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">{subtitle}</p>
          )}
          {renderInlineContext && !renderContextAtEnd ? (
            <div className="flex shrink-0 items-center gap-2">
              {showSubtitle && (
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground sm:text-xs">{subtitle}</span>
              )}
              <div className="flex shrink-0 items-center gap-2">{context}</div>
            </div>
          ) : !renderInlineContext ? (
            context && <div className="pt-1">{context}</div>
          ) : null}
        </div>

        {(renderContextAtEnd || hasHeaderActions) && (
          <div
            className={cn(
              "min-w-0 flex items-center justify-end gap-2",
              singleRow && "max-w-[65%] overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              singleRow ? "shrink-0" : "flex-1",
            )}
          >
            {hasResponsiveActions ? (
              <ResponsiveActions
                actions={actionItems ?? []}
                compact={settings.compactButtons}
                className={cn("no-print", renderContextAtEnd ? "w-auto shrink-0" : "w-full flex justify-end")}
              />
            ) : actions ? (
              <div
                className={cn(
                  "no-print flex items-center justify-end gap-1 sm:gap-1.5 md:gap-2",
                  singleRow ? "flex-nowrap" : "flex-wrap",
                )}
              >
                {actions}
              </div>
            ) : null}
            {renderContextAtEnd && hasHeaderActions && (
              <span className="shrink-0 text-sm font-medium text-border">|</span>
            )}
            {renderContextAtEnd && (
              <div className="flex shrink-0 items-center gap-2">
                {context}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
