import { Copy, Minus, Square, X } from "lucide-react";
import { Button } from "@shared/ui/button";
import { cn } from "@shared/lib/utils";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface WindowControlsProps {
  isMaximized: boolean;
  disabled?: boolean;
  variant?: "default" | "browser" | "vscode";
  onMinimize: () => void | Promise<void>;
  onToggleMaximize: () => void | Promise<void>;
  onClose: () => void | Promise<void>;
}

export function WindowControls({
  isMaximized,
  disabled = false,
  variant = "default",
  onMinimize,
  onToggleMaximize,
  onClose,
}: WindowControlsProps) {
  const { t } = useLocalization();
  const isBrowser = variant === "browser";
  const isVSCode = variant === "vscode";
  const containerClassName = isBrowser
    ? "flex items-stretch overflow-hidden rounded-t-2xl border border-border/60 bg-background/80 shadow-sm"
    : isVSCode
    ? "flex items-stretch overflow-hidden rounded-md border border-border/40 bg-background/40"
    : "flex items-stretch gap-px rounded-lg border border-border/70 bg-background/80 p-0.5 shadow-sm";
  const buttonClassName = isBrowser ? "h-12 w-12 rounded-none" : isVSCode ? "h-9 w-10 rounded-none" : "h-8 w-8 rounded-md";
  const iconClassName = isBrowser ? "h-4 w-4" : isVSCode ? "h-3.5 w-3.5" : "h-4 w-4";
  const maximizeIconClassName = isBrowser ? "h-4 w-4" : isVSCode ? "h-3.5 w-3.5" : "h-3.5 w-3.5";

  return (
    <div className={containerClassName} dir="ltr">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => void onMinimize()}
        aria-label={t("windowControls.minimize", { namespace: "shell" })}
        title={t("windowControls.minimize", { namespace: "shell" })}
        className={cn(
          buttonClassName,
          "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          (isBrowser || isVSCode) && "border-e border-border/40",
        )}
      >
        <Minus className={iconClassName} />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => void onToggleMaximize()}
        aria-label={t(isMaximized ? "windowControls.restore" : "windowControls.maximize", { namespace: "shell" })}
        title={t(isMaximized ? "windowControls.restore" : "windowControls.maximize", { namespace: "shell" })}
        className={cn(
          buttonClassName,
          "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          (isBrowser || isVSCode) && "border-e border-border/40",
        )}
      >
        {isMaximized ? <Copy className={maximizeIconClassName} /> : <Square className={maximizeIconClassName} />}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => void onClose()}
        aria-label={t("windowControls.close", { namespace: "shell" })}
        title={t("windowControls.close", { namespace: "shell" })}
        className={cn(
          buttonClassName,
          "text-muted-foreground transition-colors hover:text-white",
          "hover:bg-destructive focus-visible:bg-destructive focus-visible:text-white",
        )}
      >
        <X className={iconClassName} />
      </Button>
    </div>
  );
}
