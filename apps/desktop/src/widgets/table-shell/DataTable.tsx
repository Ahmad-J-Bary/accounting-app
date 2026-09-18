import { ReactNode } from "react";
import { cn } from '@shared/lib/utils';
import { getAlignmentClass } from "@shared/lib/table-utils";
import { Skeleton } from "@shared/ui/skeleton";
import { EmptyState } from './EmptyState';
import { useLocalization } from "@app/providers/LocalizationProvider";

export interface Column<T> {
  id?: string;
  header: ReactNode;
  accessor: keyof T | ((row: T, index?: number) => ReactNode);
  className?: string;
  headerClassName?: string;
  align?: "right" | "left" | "center";
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  idKey?: keyof T;
  skeletonRows?: number;
  selectedId?: string | number | null;
}

export function DataTable<T>({
  data,
  columns,
  onRowClick,
  onRowDoubleClick,
  loading,
  emptyMessage,
  className,
  idKey = "id" as keyof T,
  skeletonRows = 5,
  selectedId,
}: DataTableProps<T>) {
  const { t, direction } = useLocalization();
  const resolvedEmptyMessage = emptyMessage ?? t("states.noDataAvailable", { namespace: "common" });
  const getAlignment = (colIdx: number, explicitAlign?: "right" | "left" | "center") => {
    if (explicitAlign) return explicitAlign;
    if (colIdx === 0) return "right";
    if (colIdx === columns.length - 1) return "left";
    return "center";
  };

  const renderContent = () => {
    if (loading) {
      return Array.from({ length: skeletonRows }).map((_, idx) => (
        <tr key={`skeleton-${idx}`} className="animate-pulse border-b border-border/40">
          {columns.map((col, colIdx) => {
            const align = getAlignment(colIdx, col.align);
            return (
              <td key={colIdx} className="px-4 py-4">
                <Skeleton className={cn(
                  "h-4 w-full rounded-md",
                  align === "left" ? "me-0 ms-auto" : align === "center" ? "mx-auto" : "me-auto ms-0",
                  idx % 2 === 0 ? "opacity-60" : "opacity-40"
                )} />
              </td>
            );
          })}
        </tr>
      ));
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="py-20">
            <EmptyState message={resolvedEmptyMessage} />
          </td>
        </tr>
      );
    }

    return data.map((row, rowIdx) => {
      const rowId = String(row[idKey] || rowIdx);
      const isSelected = selectedId && String(selectedId) === rowId;
      
      return (
      <tr
        key={rowId}
        className={cn(
          "group transition-all duration-150 ease-out border-b border-border/40",
          onRowClick ? "cursor-pointer" : "",
          isSelected ? "bg-primary/10" : onRowClick ? "hover:bg-muted/50 active:bg-muted/70" : "hover:bg-muted/30"
        )}
        onClick={() => onRowClick?.(row)}
        onDoubleClick={() => onRowDoubleClick?.(row)}
      >
        {columns.map((col, colIdx) => {
          const align = getAlignment(colIdx, col.align);
          return (
          <td
            key={colIdx}
            className={cn(
                "px-4 py-3 text-muted-foreground transition-colors group-hover:text-foreground",
                align === "right" && "tabular-nums",
                getAlignmentClass(align),
              col.className
            )}
          >
            {typeof col.accessor === "function" 
              ? col.accessor(row, rowIdx) 
              : (row[col.accessor] as ReactNode) || "—"}
          </td>
          );
        })}
      </tr>
      );
    });
  };

  return (
    <div className={cn("border border-border rounded-xl overflow-hidden bg-card shadow-sm", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-[800px] w-full border-collapse text-sm" dir={direction}>
          <thead className="bg-muted/30 backdrop-blur-md border-b border-border sticky top-0 z-10">
            <tr>
              {columns.map((col, idx) => {
                const align = getAlignment(idx, col.align);
                return (
                <th
                  key={idx}
                  className={cn(
                    "px-4 py-3 font-bold text-foreground tracking-tight",
                    getAlignmentClass(align),
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              );
              })}
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {renderContent()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
