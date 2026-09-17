import React, { useMemo } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@shared/ui/context-menu";
import type { RowActionDescriptor } from "@shared/types/row-actions";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { cn } from "@shared/lib/utils";

interface TableRowContextMenuProps<T> {
  actions?: RowActionDescriptor<T>[] | ((row: T) => RowActionDescriptor<T>[]);
  row: T;
  children: React.ReactNode;
  disabled?: boolean;
}

export function TableRowContextMenu<T>({
  actions,
  row,
  children,
  disabled = false,
}: TableRowContextMenuProps<T>) {
  const { direction } = useLocalization();

  const resolvedActions = useMemo(() => {
    if (!actions) return [];
    const list = typeof actions === "function" ? actions(row) : actions;
    return list.filter((action) => {
      if (typeof action.hidden === "function") return !action.hidden(row);
      return !action.hidden;
    });
  }, [actions, row]);

  if (disabled || resolvedActions.length === 0) {
    return <>{children}</>;
  }

  // Separate non-destructive and destructive actions
  const normalActions = resolvedActions.filter((a) => !a.destructive && a.variant !== "destructive");
  const destructiveActions = resolvedActions.filter((a) => a.destructive || a.variant === "destructive");

  return (
    <ContextMenu dir={direction}>
      <ContextMenuTrigger asChild data-testid="table-row-context-trigger">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="min-w-[180px] p-1.5 shadow-xl border-border bg-popover text-popover-foreground"
        data-testid="table-row-context-menu"
      >
        {normalActions.map((action, idx) => {
          const isDisabled =
            typeof action.disabled === "function"
              ? action.disabled(row)
              : !!action.disabled;
          const Icon = action.icon;

          return (
            <React.Fragment key={action.id || idx}>
              {action.separator === "before" && <ContextMenuSeparator />}
              <ContextMenuItem
                disabled={isDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick(row);
                }}
                className="gap-2.5 py-2 px-2.5 text-xs font-medium cursor-pointer"
                data-testid={`row-action-${action.id}`}
              >
                {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="truncate">{action.label}</span>
              </ContextMenuItem>
              {action.separator === "after" && <ContextMenuSeparator />}
            </React.Fragment>
          );
        })}

        {destructiveActions.length > 0 && normalActions.length > 0 && (
          <ContextMenuSeparator />
        )}

        {destructiveActions.map((action, idx) => {
          const isDisabled =
            typeof action.disabled === "function"
              ? action.disabled(row)
              : !!action.disabled;
          const Icon = action.icon;

          return (
            <React.Fragment key={action.id || `destructive-${idx}`}>
              {action.separator === "before" && <ContextMenuSeparator />}
              <ContextMenuItem
                disabled={isDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick(row);
                }}
                className={cn(
                  "gap-2.5 py-2 px-2.5 text-xs font-medium cursor-pointer",
                  "text-destructive focus:text-destructive focus:bg-destructive/10"
                )}
                data-testid={`row-action-${action.id}`}
              >
                {Icon && <Icon className="h-4 w-4 text-destructive/80 shrink-0" />}
                <span className="truncate font-semibold">{action.label}</span>
              </ContextMenuItem>
              {action.separator === "after" && <ContextMenuSeparator />}
            </React.Fragment>
          );
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
}
