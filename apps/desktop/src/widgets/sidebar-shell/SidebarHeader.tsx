import { useSidePanelSettings } from "@shared/hooks/useSidePanelSettings";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { X } from "lucide-react";
import type { SidebarHeaderProps } from "./types";

export function SidebarHeader({
  title,
  subtitle,
  icon,
  onClose,
  actions,
  className,
}: SidebarHeaderProps) {
  const { settings } = useSidePanelSettings();

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-border bg-muted/50 shrink-0",
        settings.paddingPreset === "compact"
          ? "px-4 py-3"
          : settings.paddingPreset === "spacious"
          ? "px-8 py-5"
          : "px-6 py-4",
        className
      )}
    >
      <div className="flex items-center gap-3 text-start">
        {icon && <div className="text-muted-foreground shrink-0">{icon}</div>}
        <div className="flex flex-col">
          <h2 className="text-base font-bold text-foreground leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
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
            className="rounded-full text-muted-foreground hover:text-foreground hover:bg-accent w-8 h-8"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
