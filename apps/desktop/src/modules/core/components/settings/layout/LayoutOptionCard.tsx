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
        "relative flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all group text-right",
        isActive
          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
          : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/50",
        className,
      )}
    >
      {isActive && (
        <span className="absolute top-1 left-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center shadow-sm z-10">
          <Check className="w-2 h-2 text-primary-foreground" />
        </span>
      )}
      <div className="w-full overflow-hidden rounded-md border border-slate-150 group-hover:border-slate-300 transition-colors">
        {preview}
      </div>
      <span className={cn(
        "text-[9px] font-bold text-center leading-none mt-0.5",
        isActive ? "text-primary" : "text-slate-700",
      )}>
        {label}
      </span>
      {description && (
        <span className="text-[7px] text-slate-400 text-center leading-tight hidden lg:block">
          {description}
        </span>
      )}
    </button>
  );
}
