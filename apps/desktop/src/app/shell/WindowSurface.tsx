import { cn } from "@shared/lib/utils";

interface WindowSurfaceProps {
  chrome?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  direction?: "rtl" | "ltr";
  testId?: string;
}

export function WindowSurface({
  chrome,
  children,
  className,
  contentClassName,
  direction,
  testId,
}: WindowSurfaceProps) {
  return (
    <div
      className={cn("flex h-screen min-h-0 min-w-0 w-full max-w-none flex-col overflow-hidden bg-background", className)}
      dir={direction}
      data-testid={testId}
    >
      {chrome}
      <div className={cn("min-h-0 min-w-0 flex-1 overflow-hidden", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
