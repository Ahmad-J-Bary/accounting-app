import React, { ReactNode, useCallback, useRef } from "react";
import { cn } from '@shared/lib/utils';
import { Skeleton } from "@shared/ui/skeleton";
import { useTableSettings } from "@shared/hooks";
import { useColumnResize } from "@shared/hooks";
import { getAlignmentClass, getCellBorderClass, getHeaderBorderClass, getRowBackgroundClass } from "@shared/lib/table-utils";
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
  width?: string;
  onHeaderClick?: (id: string) => void;
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
  enableResize?: boolean;
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
  enableResize = false,
}: UnifiedTableProps<T>) {
  const { settings, getDensityPadding } = useTableSettings();
  const { columnWidths, handleResizeStart, setColumnWidths } = useColumnResize(columns, enableResize ? `unified_${idKey as string}` : "");
  const tableBodyRef = useRef<HTMLDivElement>(null);

  const handleAutoFit = useCallback((colId: string) => {
    if (!tableBodyRef.current) return;
    const headerEl = tableBodyRef.current.querySelector<HTMLElement>(`th[data-col-id="${colId}"]`);
    const cells = tableBodyRef.current.querySelectorAll<HTMLElement>(`td[data-col-id="${colId}"]`);
    let maxWidth = 0;
    if (headerEl) {
      const origOverflow = headerEl.style.overflow;
      headerEl.style.overflow = 'visible';
      maxWidth = headerEl.scrollWidth;
      headerEl.style.overflow = origOverflow;
    }
    cells.forEach(cell => {
      const origOverflow = cell.style.overflow;
      cell.style.overflow = 'visible';
      if (cell.scrollWidth > maxWidth) maxWidth = cell.scrollWidth;
      cell.style.overflow = origOverflow;
    });
    if (maxWidth > 0) {
      setColumnWidths(prev => ({ ...prev, [colId]: Math.max(50, Math.min(600, maxWidth + 16)) }));
    }
  }, [setColumnWidths]);

  const visibleColumns = columns.filter(col => col.visible !== false);

  const cellBorderClass = getCellBorderClass(settings.borderStyle);
  const headerBorderClass = getHeaderBorderClass(settings.borderStyle);

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
            getRowBackgroundClass(isSelected, rowIdx, settings.zebraRows, settings.rowHoverEffect),
          )}
          onClick={() => onRowClick?.(row)}
          onDoubleClick={() => onRowDoubleClick?.(row)}
        >
          {visibleColumns.map((col, colIdx) => (
              <td
                  key={colIdx}
                  data-col-id={col.id}
                  className={cn(
                getDensityPadding(),
                cellBorderClass,
                "text-slate-600 transition-colors group-hover:text-slate-900",
                getAlignmentClass(col.align),
                col.className,
                !columnWidths[col.id] && col.width,
              )}
              style={{
                fontSize: `${settings.fontSize}px`,
                fontFamily: settings.fontFamily,
                ...(enableResize ? { minWidth: 0, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const } : {}),
                ...(enableResize && columnWidths[col.id] ? { width: `${columnWidths[col.id]}px` } : {}),
              }}
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
      <div ref={tableBodyRef} className="flex-1 overflow-auto relative custom-scrollbar">
        <table className="w-full border-collapse" dir="rtl" style={{ minWidth, ...(enableResize ? { tableLayout: 'fixed' as const, width: '100%' } : {}) }}>
          <thead className={cn(
            settings.headerColor,
            settings.borderStyle !== 'none' && "border-b border-slate-200",
            settings.stickyHeader && "sticky top-0 z-10 backdrop-blur-sm shadow-sm"
          )}>
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  data-col-id={col.id}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('.cursor-col-resize')) return;
                    col.onHeaderClick?.(col.id);
                    if (col.onHeaderClick) handleAutoFit(col.id);
                  }}
                  className={cn(
                    getDensityPadding(),
                    headerBorderClass,
                    "relative text-slate-700 font-black uppercase tracking-wider select-text",
                    getAlignmentClass(col.align),
                    col.headerClassName,
                    !columnWidths[col.id] && col.width,
                    col.onHeaderClick && "cursor-pointer",
                  )}
                  style={{
                    fontSize: `${settings.fontSize - 2}px`,
                    ...(enableResize ? { minWidth: 0, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const } : {}),
                    ...(enableResize && columnWidths[col.id] ? { width: `${columnWidths[col.id]}px` } : {}),
                  }}
                >
                  {col.header}
                  {enableResize && (
                    <div
                      className="absolute top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-blue-500/10 active:bg-blue-500/20 transition-colors flex items-center justify-center group/resize"
                      style={{ left: -4 }}
                      onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, col.id); }}
                      onDoubleClick={() => handleAutoFit(col.id)}
                    >
                      <div className="w-[1px] h-3 bg-slate-200 group-hover/resize:bg-blue-400 group-active/resize:bg-blue-600 rounded-full transition-colors" />
                    </div>
                  )}
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
                    if (!entry) return <td key={col.id} data-col-id={col.id} className={cn(getDensityPadding(), cellBorderClass, "bg-slate-50/80")} />;
                    return (
                      <td
                        key={entry.id}
                        className={cn(
                          getDensityPadding(),
                          cellBorderClass,
                          "font-bold text-slate-800 bg-slate-50/80",
                          getAlignmentClass(entry.align),
                          entry.className,
                          !columnWidths[col.id] && col.width,
                        )}
                        style={{
                          fontSize: `${settings.fontSize}px`,
                          fontFamily: settings.fontFamily,
                          ...(enableResize ? { minWidth: 0, overflow: 'hidden' as const, whiteSpace: 'nowrap' as const } : {}),
                          ...(enableResize && columnWidths[col.id] ? { width: `${columnWidths[col.id]}px` } : {}),
                        }}
                      >
                        {entry.value && <span className="text-xs text-slate-400 ml-1">{entry.label}:</span>}
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
