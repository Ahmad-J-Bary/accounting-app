import type { CSSProperties, ReactNode } from "react";
import { cn } from "@shared/lib/utils";

interface GroupedEntrySharedCellProps {
  rowCount: number;
  columnPosition: number;
  className?: string;
  borderClassName?: string;
  densityClassName?: string;
  fontSize: number;
  fontFamily: string;
  children: ReactNode;
}

export function GroupedEntrySharedCell({
  rowCount,
  columnPosition,
  className,
  borderClassName,
  densityClassName,
  fontSize,
  fontFamily,
  children,
}: GroupedEntrySharedCellProps) {
  const style: CSSProperties = {
    gridRow: `1 / span ${rowCount}`,
    gridColumn: String(columnPosition),
    minWidth: 0,
    alignSelf: "stretch",
    height: "100%",
    fontSize: `${fontSize}px`,
    fontFamily,
  };

  return (
    <div
      style={style}
      className={cn(
        "min-h-full",
        borderClassName,
      )}
    >
      <div
        className={cn(
          "flex h-full min-h-full items-center justify-center text-center leading-tight",
          densityClassName,
          "text-slate-600",
          className,
        )}
      >
        {children || ""}
      </div>
    </div>
  );
}
