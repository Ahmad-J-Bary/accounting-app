import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface Column<T> {
  id?: string;
  header: ReactNode;
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
  className?: string;
  idKey?: keyof T;
  skeletonRows?: number;
  selectedId?: string | number | null;
}

export function DataTable<T>({
  data,
  columns,
  onRowClick,
  loading,
  emptyMessage = "لا توجد بيانات متاحة",
  className,
  idKey = "id" as keyof T,
  skeletonRows = 5,
  selectedId,
}: DataTableProps<T>) {
  const renderContent = () => {
    if (loading) {
      return Array.from({ length: skeletonRows }).map((_, idx) => (
        <tr key={`skeleton-${idx}`} className="animate-pulse border-b border-border/40">
          {columns.map((col, colIdx) => (
            <td key={colIdx} className="px-4 py-4">
              <Skeleton className={cn(
                "h-4 w-full rounded-md",
                col.align === "left" ? "mr-auto ml-0" : col.align === "center" ? "mx-auto" : "ml-auto mr-0",
                idx % 2 === 0 ? "opacity-60" : "opacity-40"
              )} />
            </td>
          ))}
        </tr>
      ));
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="py-24">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <div className="bg-slate-50 p-4 rounded-full mb-3 border border-slate-100/50">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm font-medium tracking-tight">{emptyMessage}</p>
              <p className="text-xs mt-1 opacity-60 italic">تأكد من إدخال البيانات بشكل صحيح</p>
            </div>
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
          isSelected ? "bg-blue-50/60" : onRowClick ? "hover:bg-slate-50/70 active:bg-slate-100" : "hover:bg-slate-50/30"
        )}
        onClick={() => onRowClick?.(row)}
      >
        {columns.map((col, colIdx) => (
          <td
            key={colIdx}
            className={cn(
              "px-4 py-4 text-slate-600 transition-colors group-hover:text-slate-900",
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
      );
    });
  };

  return (
    <div className={cn("border border-border/80 rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-100/10", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px] border-collapse" dir="rtl">
          <thead className="bg-slate-50/50 backdrop-blur-md border-b border-border/80 sticky top-0 z-10">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={cn(
                    "px-4 py-4 font-bold text-slate-700 tracking-tight",
                    col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
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
