import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";
import {
  STATUS_LABEL,
  STATUS_TONE,
  type StatusTone,
} from "@shared/ui/status";

const TONE_CLASS: Record<StatusTone, string> = {
  slate: "bg-muted text-muted-foreground ring-border border-border",
  amber: "bg-warning/10 text-warning ring-warning/20 border-warning/20",
  blue: "bg-primary/10 text-primary ring-primary/20 border-primary/20",
  green: "bg-success/10 text-success ring-success/20 border-success/20",
  orange: "bg-warning/10 text-warning ring-warning/20 border-warning/20",
  emerald: "bg-success/10 text-success ring-success/20 border-success/20",
  red: "bg-destructive/10 text-destructive ring-destructive/20 border-destructive/20",
  rose: "bg-destructive/10 text-destructive ring-destructive/20 border-destructive/20",
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