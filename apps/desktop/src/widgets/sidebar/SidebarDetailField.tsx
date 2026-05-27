import { type ReactNode } from "react";
import { cn } from '@shared/lib/utils';

export interface SidebarDetailFieldProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function SidebarDetailField({ label, value, icon, className }: SidebarDetailFieldProps) {
  return (
    <div className={cn("p-4 rounded-2xl border border-slate-100 bg-slate-50/30 flex items-start gap-3 shadow-sm", className)}>
      {icon && (
        <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shrink-0 shadow-inner">
          {icon}
        </div>
      )}
      <div className="space-y-0.5">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">{label}</span>
        <div className="font-bold text-xs text-slate-800 leading-normal">{value || "—"}</div>
      </div>
    </div>
  );
}
