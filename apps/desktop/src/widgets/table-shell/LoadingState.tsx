import { Skeleton } from "@shared/ui/skeleton";
import { cn } from "@shared/lib/utils";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface LoadingStateProps {
  rows?: number;
  className?: string;
}

/** Skeleton placeholder for lists/tables while their query is loading. */
export function LoadingState({ rows = 3, className }: LoadingStateProps) {
  const { t } = useLocalization();
  return (
    <div className={cn("p-4 space-y-3", className)} role="status" aria-label={t('states.loadingData', )}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("h-5 w-full", i === rows - 1 && "w-2/3")} />
      ))}
    </div>
  );
}
