import { cn } from "@shared/lib/utils";
import type { SidebarDetailFieldProps } from "./types";

export function SidebarDetailField({
  label,
  value,
  icon,
  className,
}: SidebarDetailFieldProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-2xl border border-muted bg-muted/30 flex items-start gap-3 shadow-sm",
        className
      )}
    >
      {icon && (
        <div className="w-8 h-8 rounded-xl bg-white border border-muted flex items-center justify-center text-muted-foreground shrink-0 shadow-inner">
          {icon}
        </div>
      )}
      <div className="space-y-0.5">
        <span className="text-3xs font-black text-muted-foreground uppercase tracking-wider block">
          {label}
        </span>
        <div className="font-bold text-xs text-foreground leading-normal">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}
