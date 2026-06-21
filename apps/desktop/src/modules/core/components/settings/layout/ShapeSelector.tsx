import { cn } from '@shared/lib/utils';
import { Check } from 'lucide-react';

export interface ShapeOption {
  id: string;
  label: string;
  description?: string;
  preview: React.ReactNode;
}

interface ShapeSelectorProps {
  title: string;
  options: ShapeOption[];
  value: string;
  onChange: (id: string) => void;
}

export function ShapeSelector({ title, options, value, onChange }: ShapeSelectorProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-slate-400 tracking-wide">
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isActive = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all group text-right",
                isActive
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {isActive && (
                <span className="absolute top-2 left-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-sm z-10">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </span>
              )}
              <div className="w-full overflow-hidden rounded-lg border border-slate-200">
                {opt.preview}
              </div>
              <span className={cn(
                "text-xs font-bold",
                isActive ? "text-primary" : "text-slate-700",
              )}>
                {opt.label}
              </span>
              {opt.description && (
                <span className="text-[9px] text-slate-400 text-center leading-tight hidden lg:block">
                  {opt.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
