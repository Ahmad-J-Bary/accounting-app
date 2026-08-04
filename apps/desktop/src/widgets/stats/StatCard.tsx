import { cn } from "@shared/lib/utils";
import type { ComponentType } from "react";

type StatCardVariant = "default" | "positive" | "negative" | "accent";

interface StatCardProps {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  variant?: StatCardVariant;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, variant = "default", className }: StatCardProps) {
  const isAccent = variant === "accent";
  const isPositive = variant === "positive";
  const isNegative = variant === "negative";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 flex items-center gap-3 shadow-sm transition-colors",
        isAccent
          ? "bg-primary border-primary text-white"
          : "bg-card border-border text-foreground",
        className,
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0",
          isAccent
            ? "bg-white/15"
            : isPositive
            ? "bg-emerald-600"
            : isNegative
            ? "bg-rose-600"
            : "bg-primary",
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <span
          className={cn(
            "text-[9px] font-black uppercase tracking-widest block",
            isAccent ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <div
          className={cn(
            "text-sm font-black tabular-nums leading-tight",
            isAccent
              ? "text-white"
              : isPositive
              ? "text-emerald-700"
              : isNegative
              ? "text-rose-700"
              : "text-foreground",
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
