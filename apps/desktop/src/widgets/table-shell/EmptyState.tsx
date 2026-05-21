import React from 'react';
import { cn } from '@shared/lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  suggestion?: string;
  icon?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message = "لا توجد بيانات متاحة",
  suggestion = "جرب تغيير معايير البحث أو إضافة بيانات جديدة",
  icon,
  className,
  compact,
}) => {
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
      <p className={cn("font-bold text-slate-500", compact ? "text-sm" : "text-base")}>{message}</p>
      {suggestion && (
        <p className={cn("mt-1 opacity-70", compact ? "text-xs" : "text-sm")}>{suggestion}</p>
      )}
    </div>
  );
};
