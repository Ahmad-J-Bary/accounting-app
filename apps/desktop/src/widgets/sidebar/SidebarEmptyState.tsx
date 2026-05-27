import { type ReactNode } from "react";
import { cn } from '@shared/lib/utils';
import { AlertCircle } from "lucide-react";

interface SidebarEmptyStateProps {
  message?: string;
  icon?: ReactNode;
  className?: string;
}

export function SidebarEmptyState({
  message = "الرجاء اختيار عنصر لعرض تفاصيله",
  icon,
  className
}: SidebarEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center space-y-4 text-slate-400 h-full", className)}>
      <div className="p-4 bg-slate-50 rounded-full border border-dashed border-slate-200">
        {icon || <AlertCircle className="w-8 h-8 text-slate-300" />}
      </div>
      <p className="text-xs font-bold text-slate-500 max-w-[240px] leading-relaxed">{message}</p>
    </div>
  );
}
