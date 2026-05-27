import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from '@shared/lib/utils';
import type { SidebarSectionProps } from "./types";

export function SidebarSection({ title, icon, children, className = "", defaultOpen = true }: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("border border-slate-100 rounded-xl bg-slate-50/30 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.01)]", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100/60 transition text-right border-b border-slate-100"
      >
        <span className="flex items-center gap-2 text-xs font-black text-slate-800">
          {icon && <span className="text-slate-500">{icon}</span>}
          {title}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", !isOpen && "-rotate-90")} />
      </button>
      <div
        className={cn(
          "transition-all duration-200 overflow-hidden",
          isOpen ? "p-4 max-h-[1000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none p-0"
        )}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sidebar-section-gap)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
