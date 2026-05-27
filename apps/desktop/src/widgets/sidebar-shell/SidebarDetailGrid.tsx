import React from "react";
import { cn } from "@shared/lib/utils";
import { SidebarDetailField } from "./SidebarDetailField";
import type { SidebarDetailGridProps } from "./types";

export function SidebarDetailGrid({
  fields,
  columns = 1,
  title,
  icon,
  className,
}: SidebarDetailGridProps) {
  if (!fields || fields.length === 0) return null;
  return (
    <div
      className={cn(
        "p-4 rounded-2xl border border-slate-100 bg-white/70 backdrop-blur-sm shadow-sm",
        className
      )}
    >
      {title && (
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2 mb-4">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            {title}
          </span>
        </div>
      )}
      <div
        className={cn(
          "grid gap-4",
          columns === 2 ? "grid-cols-2" : "grid-cols-1"
        )}
      >
        {fields.map((f, i) => (
          <SidebarDetailField key={i} {...f} />
        ))}
      </div>
    </div>
  );
}
