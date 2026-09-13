import React from 'react';
import { cn } from '@shared/lib/utils';
import { Inbox } from 'lucide-react';
import { useLocalization } from "@app/providers/LocalizationProvider";

interface EmptyStateProps {
  message?: string;
  suggestion?: string;
  icon?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  suggestion,
  icon,
  className,
  compact,
}) => {
  const { t } = useLocalization();
  const resolvedMessage = message ?? t('states.noDataAvailable', );
  const resolvedSuggestion = suggestion ?? t('states.tryChangingSearchCriteria', );
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-slate-400",
      compact ? "py-10" : "py-20",
      className
    )}>
      <div className={cn(
        "flex items-center justify-center mb-4 border",
        compact ? "p-4 rounded-xl" : "p-6 rounded-full",
        "bg-slate-50 border-slate-100"
      )}>
        {icon || <Inbox className={cn("text-slate-300", compact ? "w-6 h-6" : "w-10 h-10")} />}
      </div>
      <p className={cn("font-bold text-slate-500", compact ? "text-sm" : "text-base")}>{resolvedMessage}</p>
      {resolvedSuggestion && (
        <p className={cn("mt-1 opacity-70", compact ? "text-xs" : "text-sm")}>{resolvedSuggestion}</p>
      )}
    </div>
  );
};
