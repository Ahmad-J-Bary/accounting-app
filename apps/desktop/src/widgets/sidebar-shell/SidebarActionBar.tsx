import React from "react";
import { cn } from "@shared/lib/utils";
import type { SidebarAction, SidebarActionBarProps } from "./types";

const ACTION_ICON_COLORS: Record<NonNullable<SidebarAction["variant"]>, string> = {
  primary: "text-blue-600",
  secondary: "text-slate-500",
  success: "text-emerald-600",
  danger: "text-red-500",
  warning: "text-amber-600",
};

export function SidebarActionBar({
  actions,
  className,
  maxColumns = 2,
}: SidebarActionBarProps) {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;

  const cols =
    visible.length === 1 ? 1 : Math.min(visible.length, maxColumns);

  return (
    <div
      className={cn(
        "grid gap-2 px-4 py-3 border-b border-slate-100 bg-white/60 shrink-0",
        cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-3",
        className
      )}
    >
      {visible.map((act, idx) => (
        <button
          key={idx}
          type="button"
          onClick={act.onClick}
          disabled={act.disabled}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-bold transition-all duration-150 whitespace-nowrap select-none",
            "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "shrink-0 w-4 h-4 flex items-center justify-center",
              ACTION_ICON_COLORS[act.variant ?? "secondary"]
            )}
          >
            {act.icon}
          </span>
          {act.label}
        </button>
      ))}
    </div>
  );
}
