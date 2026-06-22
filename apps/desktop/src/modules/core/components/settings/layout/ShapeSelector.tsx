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
    <div>
      <h4 className="text-[9px] font-bold text-slate-400 tracking-wide mb-1.5">
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((opt) => {
          const isActive = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={cn(
                "relative flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all group text-right",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                  : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/50",
              )}
            >
              {isActive && (
                <span className="absolute top-1 left-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center shadow-sm z-10">
                  <Check className="w-2 h-2 text-primary-foreground" />
                </span>
              )}
              <div className="w-full overflow-hidden rounded-md border border-slate-150">
                {opt.preview}
              </div>
              <span className={cn(
                "text-[9px] font-bold mt-0.5",
                isActive ? "text-primary" : "text-slate-700",
              )}>
                {opt.label}
              </span>
              {opt.description && (
                <span className="text-[7px] text-slate-400 text-center leading-tight hidden lg:block">
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
