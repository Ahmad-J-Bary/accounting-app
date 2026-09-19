import { Copy, Minus, Square, X } from "lucide-react";
import { Button } from "@shared/ui/button";
import { cn } from "@shared/lib/utils";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface WindowControlsProps {
  isMaximized: boolean;
  disabled?: boolean;
  onMinimize: () => void | Promise<void>;
  onToggleMaximize: () => void | Promise<void>;
  onClose: () => void | Promise<void>;
}

export function WindowControls({
  isMaximized,
  disabled = false,
  onMinimize,
  onToggleMaximize,
  onClose,
}: WindowControlsProps) {
  const { t } = useLocalization();

  return (
    <div className="flex items-stretch gap-px rounded-lg border border-border/70 bg-background/80 p-0.5 shadow-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => void onMinimize()}
        aria-label={t("windowControls.minimize", { namespace: "shell" })}
        title={t("windowControls.minimize", { namespace: "shell" })}
        className="h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Minus className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => void onToggleMaximize()}
        aria-label={t(isMaximized ? "windowControls.restore" : "windowControls.maximize", { namespace: "shell" })}
        title={t(isMaximized ? "windowControls.restore" : "windowControls.maximize", { namespace: "shell" })}
        className="h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
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
          "h-8 w-8 rounded-md text-muted-foreground hover:text-white",
          "hover:bg-destructive focus-visible:bg-destructive focus-visible:text-white",
        )}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
