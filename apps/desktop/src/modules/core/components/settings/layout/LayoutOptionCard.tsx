import { cn } from '@shared/lib/utils';
import { Check } from 'lucide-react';

interface LayoutOptionCardProps {
  isActive: boolean;
  onClick: () => void;
  label: string;
  description?: string;
  preview: React.ReactNode;
  className?: string;
}

export function LayoutOptionCard({
  isActive,
  onClick,
  label,
  description,
  preview,
  className,
}: LayoutOptionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all group text-right",
        isActive
          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
        className,
      )}
    >
      {isActive && (
        <span className="absolute top-2 left-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm z-10">
          <Check className="w-3 h-3 text-primary-foreground" />
        </span>
      )}
      <div className="w-full overflow-hidden rounded-lg border border-slate-200 group-hover:border-slate-300 transition-colors">
        {preview}
      </div>
      <span className={cn(
        "text-xs font-bold text-center leading-tight",
        isActive ? "text-primary" : "text-slate-700",
      )}>
        {label}
      </span>
      {description && (
        <span className="text-[9px] text-slate-400 text-center leading-tight hidden lg:block">
          {description}
        </span>
      )}
    </button>
  );
}
