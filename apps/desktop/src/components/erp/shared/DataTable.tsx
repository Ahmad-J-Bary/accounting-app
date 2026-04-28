import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  /**
   * Field name or function to render the cell content
   */
  accessor: keyof T | ((row: T) => ReactNode);
  className?: string;
  headerClassName?: string;
  align?: "right" | "left" | "center";
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  /**
   * Additional class name for the wrapper div
   */
  className?: string;
  /**
   * Unique ID key for rows, defaults to 'id'
   */
  idKey?: keyof T;
}

/**
 * A generalized, reusable data table component for ERP pages.
 * Supports custom rendering, alignment, and row actions.
 */
export function DataTable<T>({
  data,
  columns,
  onRowClick,
  loading,
  emptyMessage = "لا توجد بيانات متاحة",
  className,
  idKey = "id" as keyof T,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 animate-pulse">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm font-medium">جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/30">
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("border border-border rounded-xl overflow-x-auto bg-white shadow-sm", className)}>
      <table className="w-full text-sm min-w-[700px] border-collapse" dir="rtl">
        <thead className="bg-slate-50/80 backdrop-blur-sm border-b border-border sticky top-0 z-10">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={cn(
                  "px-4 py-3.5 font-bold text-slate-700 transition-colors",
                  col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right",
                  col.headerClassName
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {data.map((row, rowIdx) => (
            <tr
              key={String(row[idKey] || rowIdx)}
              className={cn(
                "group transition-all duration-200 ease-in-out",
                onRowClick ? "cursor-pointer hover:bg-slate-50/80 active:bg-slate-100" : "hover:bg-slate-50/30"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className={cn(
                    "px-4 py-3.5 text-slate-600 transition-colors",
                    col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right",
                    col.className
                  )}
                >
                  {typeof col.accessor === "function" 
                    ? col.accessor(row) 
                    : (row[col.accessor] as ReactNode) || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
