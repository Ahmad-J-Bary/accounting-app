import React, { ReactNode } from "react";
import { cn } from '@shared/lib/utils';
import { Skeleton } from "@shared/ui/skeleton";
import { useTableSettings } from "@shared/hooks";

export interface UnifiedColumn<T> {
  id: string;
  header: ReactNode;
  label?: string; // Human-readable label for column manager
  accessor: keyof T | ((row: T, index: number) => ReactNode);
  className?: string;
  headerClassName?: string;
  align?: "right" | "left" | "center";
  visible?: boolean;
}

interface UnifiedTableProps<T> {
  data: T[];
  columns: UnifiedColumn<T>[];
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  idKey?: keyof T;
  skeletonRows?: number;
  selectedId?: string | number | null;
}

export function UnifiedTable<T>({
  data,
  columns,
  onRowClick,
  onRowDoubleClick,
  loading,
  emptyMessage = "لا توجد بيانات متاحة",
  className,
  idKey = "id" as keyof T,
  skeletonRows = 5,
  selectedId,
}: UnifiedTableProps<T>) {
  const { settings, getDensityPadding } = useTableSettings();

  const visibleColumns = columns.filter(col => col.visible !== false);

  const getAlignmentClass = (align?: "right" | "left" | "center") => {
    switch (align) {
      case "left": return "text-left";
      case "center": return "text-center";
      case "right":
      default: return "text-right";
    }
  };

  const borderClass = cn(
    settings.borderStyle === 'full' && "border",
    settings.borderStyle === 'horizontal' && "border-b",
    "border-slate-200"
  );

  const renderContent = () => {
    if (loading) {
      return Array.from({ length: skeletonRows }).map((_, idx) => (
        <tr key={`skeleton-${idx}`} className={cn("animate-pulse", borderClass)}>
          {visibleColumns.map((col, colIdx) => (
            <td key={colIdx} className={getDensityPadding()}>
              <Skeleton className={cn(
                "h-4 w-full rounded",
                col.align === "left" ? "mr-auto ml-0" : col.align === "center" ? "mx-auto" : "ml-auto mr-0",
              )} />
            </td>
          ))}
        </tr>
      ));
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={visibleColumns.length} className="py-20">
            <div className="flex flex-col items-center justify-center text-slate-400">
              <div className="bg-slate-50 p-6 rounded-full mb-4 border border-slate-100">
                <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-base font-bold text-slate-500">{emptyMessage}</p>
              <p className="text-sm mt-1 opacity-70">جرب تغيير معايير البحث أو إضافة بيانات جديدة</p>
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
            "group transition-all duration-75",
            borderClass,
            onRowClick ? "cursor-pointer" : "",
            isSelected ? "bg-blue-50/80" : settings.rowHoverEffect ? "hover:bg-slate-50/80" : "",
            settings.zebraRows && rowIdx % 2 === 1 && !isSelected ? "bg-slate-50/30" : ""
          )}
          onClick={() => onRowClick?.(row)}
          onDoubleClick={() => onRowDoubleClick?.(row)}
        >
          {visibleColumns.map((col, colIdx) => (
            <td
              key={colIdx}
              className={cn(
                getDensityPadding(),
                "text-slate-600 transition-colors group-hover:text-slate-900",
                getAlignmentClass(col.align),
                col.className
              )}
              style={{ fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily }}
            >
              {typeof col.accessor === "function" 
                ? col.accessor(row, rowIdx) 
                : (row[col.accessor] as ReactNode) || "—"}
            </td>
          ))}
        </tr>
      );
    });
  };

  return (
    <div className={cn("w-full h-full", className)}>
      <table className="w-full border-collapse" dir="rtl">
        <thead className={cn(
          settings.headerColor,
          "border-b border-slate-200",
          settings.stickyHeader && "sticky top-0 z-10 backdrop-blur-sm shadow-sm"
        )}>
          <tr>
            {visibleColumns.map((col, idx) => (
              <th
                key={col.id}
                className={cn(
                  getDensityPadding(),
                  "font-black text-slate-700 uppercase tracking-wider",
                  getAlignmentClass(col.align),
                  col.headerClassName
                )}
                style={{ fontSize: `${settings.fontSize - 2}px` }}
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
  );
}
