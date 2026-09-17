import { Button } from "@shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";
import { LucideIcon, MoreHorizontal, Eye, Edit, Trash2, Download } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { RowActionDescriptor } from "@shared/types/row-actions";

interface LegacyActionItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "danger" | "destructive";
}

interface TableActionsProps<T = unknown> {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onExportRow?: () => void;
  extraActions?: LegacyActionItem[];
  actions?: RowActionDescriptor<T>[];
  row?: T;
  align?: "start" | "end";
  defaultOpen?: boolean;
}

export function TableActions<T = unknown>({
  onView,
  onEdit,
  onDelete,
  onExportRow,
  extraActions,
  actions,
  row,
  align = "end",
  defaultOpen,
}: TableActionsProps<T>) {
  const { t, direction } = useLocalization();

  // If new actions array is provided, render using unified descriptor model
  if (actions && actions.length > 0 && row !== undefined) {
    const visibleActions = actions.filter((action) => {
      if (typeof action.hidden === "function") return !action.hidden(row);
      return !action.hidden;
    });

    const normal = visibleActions.filter((a) => !a.destructive && a.variant !== "destructive");
    const destructive = visibleActions.filter((a) => a.destructive || a.variant === "destructive");

    return (
      <div onClick={(e) => e.stopPropagation()} dir={direction}>
        <DropdownMenu defaultOpen={defaultOpen} dir={direction}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-md"
              data-testid="table-row-kebab-button"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={align}
            className="min-w-[150px] rounded-xl border-border bg-popover text-popover-foreground text-start shadow-xl p-1"
          >
            {normal.map((action, idx) => {
              const isDisabled =
                typeof action.disabled === "function"
                  ? action.disabled(row)
                  : !!action.disabled;
              const Icon = action.icon;
              return (
                <span key={action.id || idx}>
                  {action.separator === "before" && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    disabled={isDisabled}
                    onClick={() => action.onClick(row)}
                    className="gap-2.5 cursor-pointer py-2 px-2 text-xs font-medium"
                  >
                    {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className="truncate">{action.label}</span>
                  </DropdownMenuItem>
                  {action.separator === "after" && <DropdownMenuSeparator />}
                </span>
              );
            })}

            {destructive.length > 0 && normal.length > 0 && <DropdownMenuSeparator />}

            {destructive.map((action, idx) => {
              const isDisabled =
                typeof action.disabled === "function"
                  ? action.disabled(row)
                  : !!action.disabled;
              const Icon = action.icon;
              return (
                <span key={action.id || `dest-${idx}`}>
                  {action.separator === "before" && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    disabled={isDisabled}
                    onClick={() => action.onClick(row)}
                    className={cn(
                      "gap-2.5 cursor-pointer py-2 px-2 text-xs font-medium",
                      "text-destructive focus:text-destructive focus:bg-destructive/10"
                    )}
                  >
                    {Icon && <Icon className="w-4 h-4 text-destructive/80 shrink-0" />}
                    <span className="truncate font-semibold">{action.label}</span>
                  </DropdownMenuItem>
                  {action.separator === "after" && <DropdownMenuSeparator />}
                </span>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Legacy fallback implementation
  return (
    <div onClick={(e) => e.stopPropagation()} dir={direction}>
      <DropdownMenu defaultOpen={defaultOpen} dir={direction}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-md"
            data-testid="table-row-kebab-button"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className="min-w-[140px] rounded-xl border-border bg-popover text-popover-foreground text-start shadow-xl p-1"
        >
          {onView && (
            <DropdownMenuItem onClick={onView} className="gap-2 cursor-pointer py-2 px-2 text-xs">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span>{t("labels.viewDetails", { namespace: "common" })}</span>
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem onClick={onEdit} className="gap-2 cursor-pointer py-2 px-2 text-xs">
              <Edit className="w-4 h-4 text-muted-foreground" />
              <span>{t("labels.editData", { namespace: "common" })}</span>
            </DropdownMenuItem>
          )}

          {extraActions?.map((action, idx) => {
            const isDanger = action.variant === "danger" || action.variant === "destructive";
            return (
              <DropdownMenuItem
                key={idx}
                onClick={action.onClick}
                className={cn(
                  "gap-2 cursor-pointer py-2 px-2 text-xs",
                  isDanger && "text-destructive focus:text-destructive focus:bg-destructive/10"
                )}
              >
                <action.icon
                  className={cn("w-4 h-4", isDanger ? "text-destructive/80" : "text-muted-foreground")}
                />
                <span>{action.label}</span>
              </DropdownMenuItem>
            );
          })}

          {onExportRow && (
            <DropdownMenuItem onClick={onExportRow} className="gap-2 cursor-pointer py-2 px-2 text-xs">
              <Download className="w-4 h-4 text-muted-foreground" />
              <span>{t("labels.exportExcel", { namespace: "common" })}</span>
            </DropdownMenuItem>
          )}

          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 cursor-pointer py-2 px-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/10 font-medium"
              >
                <Trash2 className="w-4 h-4 text-destructive/80" />
                <span>{t("labels.deleteRecord", { namespace: "common" })}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
