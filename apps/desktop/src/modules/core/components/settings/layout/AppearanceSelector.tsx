import type { NavbarAppearance } from '@shared/types/appearance';
import { cn } from '@shared/lib/utils';
import { Check, Sun, Moon } from 'lucide-react';

interface AppearanceSelectorProps {
  title: string;
  value: NavbarAppearance;
  onChange: (v: NavbarAppearance) => void;
  lightPreview?: React.ReactNode;
  darkPreview?: React.ReactNode;
}

export function AppearanceSelector({
  title,
  value,
  onChange,
  lightPreview,
  darkPreview,
}: AppearanceSelectorProps) {
  const options: { id: NavbarAppearance; label: string; icon: typeof Sun; preview?: React.ReactNode }[] = [
    { id: 'light', label: 'فاتح', icon: Sun, preview: lightPreview },
    { id: 'dark', label: 'داكن', icon: Moon, preview: darkPreview },
  ];

  return (
    <div>
      <h4 className="text-[9px] font-bold text-slate-400 tracking-wide mb-1.5">
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((opt) => {
          const isActive = value === opt.id;
          const Icon = opt.icon;
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
              <Icon className={cn(
                "w-3.5 h-3.5",
                isActive ? "text-primary" : "text-slate-400",
              )} />
              {opt.preview && (
                <div className="w-full overflow-hidden rounded-md border border-slate-150">
                  {opt.preview}
                </div>
              )}
              <span className={cn(
                "text-[9px] font-bold mt-0.5",
                isActive ? "text-primary" : "text-slate-700",
              )}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
