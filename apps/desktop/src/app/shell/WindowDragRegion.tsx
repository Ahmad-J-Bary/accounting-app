import type { HTMLAttributes } from "react";
import { cn } from "@shared/lib/utils";

interface WindowDragRegionProps extends HTMLAttributes<HTMLDivElement> {
  enabled: boolean;
  onDoubleClick: () => void;
  className?: string;
  direction?: "rtl" | "ltr";
  title?: string;
  children?: React.ReactNode;
  testId?: string;
}

export function WindowDragRegion({
  enabled,
  onDoubleClick,
  className,
  direction,
  title,
  children,
  testId,
  ...rest
}: WindowDragRegionProps) {
  return (
    <div
      data-tauri-drag-region={enabled ? true : undefined}
      onDoubleClick={onDoubleClick}
      dir={direction}
      title={title}
      className={cn("min-w-0 select-none", className)}
      data-testid={testId}
      {...rest}
    >
      {children}
    </div>
  );
}
