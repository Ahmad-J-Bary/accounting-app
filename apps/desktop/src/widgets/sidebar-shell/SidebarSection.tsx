import React, { ReactNode, useState } from "react";
import { cn } from "@shared/lib/utils";
import { ChevronDown } from "lucide-react";
import type { SidebarSectionProps } from "./types";

export function SidebarSection({
  title,
  icon,
  children,
  defaultOpen = true,
  className,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "border border-slate-100 rounded-xl bg-slate-50/30 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.01)]",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100/60 transition text-right border-b border-slate-100"
      >
        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">{icon}{title}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 transition-transform duration-200",
            !isOpen && "rotate-90"
          )}
        />
      </button>
      <div
        className={cn(
          "transition-all duration-200 overflow-hidden",
          isOpen ? "p-4 max-h-[1000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}
