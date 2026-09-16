import { cn } from "@shared/lib/utils";
import { AlertCircle } from "lucide-react";
import type { SidebarEmptyStateProps } from "./types";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function SidebarEmptyState({
  message,
  icon,
  className,
}: SidebarEmptyStateProps) {
  const { t } = useLocalization();
  const resolvedMessage = message ?? t('labels.selectItemToView', );
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center space-y-4 text-muted-foreground h-full",
        className
      )}
    >
      <div className="p-4 bg-muted rounded-full border border-dashed border-muted">
        {icon || <AlertCircle className="w-8 h-8 text-muted-foreground" />}
      </div>
      <p className="text-xs font-bold text-muted-foreground max-w-[240px] leading-relaxed">
        {resolvedMessage}
      </p>
    </div>
  );
}
