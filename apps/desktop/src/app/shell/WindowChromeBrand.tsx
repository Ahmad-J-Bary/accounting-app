import { Building2 } from "lucide-react";
import { cn } from "@shared/lib/utils";

interface WindowChromeBrandProps {
  compact?: boolean;
  direction: "rtl" | "ltr";
  brandLabel: string;
  companyLabel: string;
  className?: string;
}

export function WindowChromeBrand({
  compact = false,
  direction,
  brandLabel,
  companyLabel,
  className,
}: WindowChromeBrandProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        compact
          ? "h-11 rounded-t-2xl border border-border/60 bg-background/80 px-3 shadow-sm"
          : "",
        className,
      )}
      dir={direction}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm",
          compact ? "h-8 w-8" : "h-8 w-8",
        )}
      >
        <Building2 className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className={cn("truncate font-bold text-foreground", compact ? "text-[13px]" : "text-sm")}>
          {brandLabel}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{companyLabel}</div>
      </div>
    </div>
  );
}
