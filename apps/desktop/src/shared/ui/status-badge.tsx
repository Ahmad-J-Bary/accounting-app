import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";
import {
  STATUS_LABEL,
  STATUS_TONE,
  type StatusTone,
} from "@shared/ui/status";

const TONE_CLASS: Record<StatusTone, string> = {
  slate: "bg-slate-50 text-slate-700 ring-slate-200 border-slate-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200 border-amber-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200 border-blue-200",
  green: "bg-green-50 text-green-700 ring-green-200 border-green-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200 border-orange-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200 border-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200 border-red-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200 border-rose-200",
};

export interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: "sm" | "md";
  icon?: ReactNode;
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({ status, label, size = "sm", icon, tone, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? STATUS_TONE[status] ?? "slate";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-bold ring-1 ring-inset border rounded-full whitespace-nowrap",
        size === "sm" ? "text-2xs px-2 py-0.5" : "text-xs px-3 py-1",
        TONE_CLASS[resolvedTone],
        className,
      )}
    >
      {icon}
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}