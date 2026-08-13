import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { cn } from "@shared/lib/utils";

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  className?: string;
}

/**
 * Standard admin card section: icon + bold title (+ optional description) in
 * the header, arbitrary content below. Mirrors the exact classes used across
 * the accounting modules so pages stay visually uniform.
 */
export function SectionCard({
  title,
  icon,
  description,
  action,
  children,
  contentClassName,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn("border-slate-200 shadow-sm", className)}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            {icon} {title}
          </CardTitle>
          {action}
        </div>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </CardHeader>
      <CardContent className={cn("space-y-3", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
