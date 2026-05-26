import React, { ReactNode } from "react";
import { cn } from '@shared/lib/utils';
import { Skeleton } from "@shared/ui/skeleton";
import { useTableSettings } from "@shared/hooks";
import type { SummaryColumn } from './TableSummary';
import { TablePagination } from './TablePagination';
import { EmptyState } from './EmptyState';

export interface UnifiedColumn<T> {
  id: string;
  header: ReactNode;
  label?: string;
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
  emptySuggestion?: string;
  emptyIcon?: ReactNode;
  className?: string;
  idKey?: keyof T;
  skeletonRows?: number;
  selectedId?: string | number | null;
  summary?: SummaryColumn[];
  summaryColSpan?: number;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    pageSize?: number;
  };
  minWidth?: string;
}

export function UnifiedTable<T>({
  data,
  columns,
  onRowClick,
  onRowDoubleClick,
  loading,
  emptyMessage = "لا توجد بيانات متاحة",
  emptySuggestion,
  emptyIcon,
  className,
  idKey = "id" as keyof T,
  skeletonRows = 5,
  selectedId,
  summary,
  summaryColSpan,
  pagination,
  minWidth = "auto",
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

  const cellBorderClass = cn(
    settings.borderStyle === 'full' && "border border-slate-200",
    settings.borderStyle === 'horizontal' && "border-b border-slate-200",
    settings.borderStyle === 'none' && "border-0"
  );

  const headerBorderClass = cn(
    settings.borderStyle === 'full' && "border border-slate-200",
    settings.borderStyle === 'horizontal' && "border-b border-slate-200",
    settings.borderStyle === 'none' && "border-0"
  );

  const renderContent = () => {
    if (loading) {
      return Array.from({ length: skeletonRows }).map((_, idx) => (
        <tr key={`skeleton-${idx}`} className="animate-pulse">
          {visibleColumns.map((col, colIdx) => (
            <td key={colIdx} className={cn(getDensityPadding(), cellBorderClass)}>
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
          <td colSpan={visibleColumns.length} className={cellBorderClass}>
            <EmptyState
              message={emptyMessage}
              suggestion={emptySuggestion}
              icon={emptyIcon}
            />
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
            onRowClick ? "cursor-pointer" : "",
            isSelected ? "bg-blue-50/80" : settings.rowHoverEffect ? "hover:bg-slate-50/80" : "",
            settings.zebraRows && rowIdx % 2 === 1 && !isSelected ? "bg-slate-100/60" : ""
          )}
          onClick={() => onRowClick?.(row)}
          onDoubleClick={() => onRowDoubleClick?.(row)}
        >
          {visibleColumns.map((col, colIdx) => (
            <td
              key={colIdx}
              className={cn(
                getDensityPadding(),
                cellBorderClass,
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
    <div className={cn("w-full h-full flex flex-col", className)}>
      <div className="flex-1 overflow-auto relative custom-scrollbar">
        <table className="w-full border-collapse" dir="rtl" style={{ minWidth }}>
          <thead className={cn(
            settings.headerColor,
            settings.borderStyle !== 'none' && "border-b border-slate-200",
            settings.stickyHeader && "sticky top-0 z-10 backdrop-blur-sm shadow-sm"
          )}>
            <tr>
              {visibleColumns.map((col, idx) => (
                <th
                  key={col.id}
                  className={cn(
                    getDensityPadding(),
                    headerBorderClass,
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
            {summary && summary.length > 0 && settings.showSummary && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="border-t-2 border-slate-300">
                {(() => {
                  // Build a map from columnId → summary entry for proper alignment with visible columns
                  const summaryMap = new Map<string, SummaryColumn>();
                  summary.forEach(s => {
                    if (s.columnId) {
                      summaryMap.set(s.columnId, s);
                    }
                  });
                  return visibleColumns.map(col => {
                    const entry = (col.id && summaryMap.has(col.id))
                      ? summaryMap.get(col.id)!
                      : summary.find(s => s.id === col.id || s.id === `${col.id}_summary` || s.id === `${col.id}_spacer`);
                    if (!entry) return <td key={col.id} className={cn(getDensityPadding(), cellBorderClass, "bg-slate-50/80")} />;
                    return (
                      <td
                        key={entry.id}
                        className={cn(
                          getDensityPadding(),
                          cellBorderClass,
                          "font-bold text-slate-800 bg-slate-50/80",
                          getAlignmentClass(entry.align),
                          entry.className
                        )}
                        style={{ fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily }}
                      >
                        <span className="text-xs text-slate-400 ml-1">{entry.label}:</span>
                        {entry.value}
                      </td>
                    );
                  });
                })()}
                {summaryColSpan && summary.length < visibleColumns.length && (
                  <td
                    className={cn(getDensityPadding(), cellBorderClass, "bg-slate-50/80")}
                    colSpan={visibleColumns.length - summary.length}
                  />
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {pagination && settings.showPagination && (
        <div className="border-t border-slate-100 bg-slate-50/30 px-4 py-2">
          <TablePagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
          />
        </div>
      )}
    </div>
  );
}
