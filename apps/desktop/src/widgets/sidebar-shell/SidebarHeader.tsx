import { useSidePanelSettings } from "@shared/hooks/useSidePanelSettings";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { X } from "lucide-react";
import type { SidebarHeaderProps } from "./types";

export function SidebarHeader({
  title,
  subtitle,
  icon,
  context,
  contextInline = false,
  onClose,
  actions,
  className,
}: SidebarHeaderProps) {
  const { settings } = useSidePanelSettings();

  if (contextInline) {
    return (
      <div
        className={cn(
          "shrink-0 border-b border-border bg-muted/50",
          settings.paddingPreset === "compact"
            ? "px-4 py-3"
            : settings.paddingPreset === "spacious"
            ? "px-8 py-5"
            : "px-6 py-4",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {icon && <div className="shrink-0 text-muted-foreground">{icon}</div>}
            <h2 className="shrink-0 text-base font-bold leading-tight text-foreground">
              {title}
            </h2>
            {subtitle && (
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                {subtitle}
              </span>
            )}
            {context && (
              <div className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                {context}
              </div>
            )}
            {actions && (
              <div className="flex shrink-0 items-center gap-2">
                {actions}
              </div>
            )}
          </div>

          {settings.closeButtonVisibility && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "shrink-0 border-b border-border bg-muted/50",
        settings.paddingPreset === "compact"
          ? "px-4 py-3"
          : settings.paddingPreset === "spacious"
          ? "px-8 py-5"
          : "px-6 py-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-1 items-start gap-3 text-start">
          {icon && <div className="shrink-0 pt-0.5 text-muted-foreground">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-tight text-foreground">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
          {settings.closeButtonVisibility && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {context && !contextInline && <div className="mt-3 flex flex-wrap items-center gap-2">{context}</div>}
    </div>
  );
}
