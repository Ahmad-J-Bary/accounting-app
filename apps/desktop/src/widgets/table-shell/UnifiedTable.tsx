import React, { ReactNode, useCallback, useMemo } from "react";
import { cn } from '@shared/lib/utils';
import { Skeleton } from "@shared/ui/skeleton";
import { useTableSettings, useColumnResize } from "@shared/hooks";
import {
  getRowBackgroundClass,
  getRowBorderClass,
  getLeftBorderClass,
  parseWidthFromClassName,
} from "@shared/lib/table-utils";
import type { SummaryColumn } from './TableSummary';
import { TableSummary } from './TableSummary';
import { TablePagination } from './TablePagination';
import { EmptyState } from './EmptyState';
import { GridHeader, type GridHeaderColumn } from './GridHeader';
import type { AutoFitColumnOptions } from "@shared/hooks/useColumnResize";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UnifiedColumn<T> {
  id: string;
  header: ReactNode;
  /** Plain-text label for dropdowns / auto-fit measurement */
  label?: string;
  accessor: keyof T | ((row: T, index: number) => ReactNode);
  /** Extra CSS classes applied to body cells (Tailwind width classes are parsed
   *  for flex layout and should still be included – inline style wins). */
  className?: string;
  headerClassName?: string;
  align?: "right" | "left" | "center";
  visible?: boolean;
  /** Tailwind width class, e.g. "w-[80px]" – parsed for initial column width */
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
  /** Summary row data – one entry per visible column (empty value = spacer) */
  summary?: SummaryColumn[];
  /** @deprecated – not used in flex layout (TableSummary handles its own layout) */
  summaryColSpan?: number;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    pageSize?: number;
  };
  /** Minimum horizontal width of the table content area */
  minWidth?: string;
  /** Enable per-column drag resize + click-to-fit */
  enableResize?: boolean;
  onHeaderClick?: (col: UnifiedColumn<T>) => void;
  /** Unique key for persisting column widths in localStorage */
  tableId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getHeaderText<T>(col: UnifiedColumn<T>): string {
  if (typeof col.header === "string") return col.header;
  if (typeof col.label === "string") return col.label;
  return col.id;
}

function getPrimitiveCellValue(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UnifiedTable – The single table primitive for the desktop app.
 *
 * Layout: pure CSS Flex (no <table> element).
 * - Header: <GridHeader> (Flex, sticky, resize handles)
 * - Rows:   Flex <div> rows
 * - Summary: <TableSummary> (sticky bottom inside scroll area)
 * - Pagination: outside scroll area
 *
 * Column widths are resolved by getFlexColumnStyle (useColumnResize):
 *   1. User resize override (inline px)
 *   2. col.width Tailwind class (e.g. "w-[80px]")
 *   3. col.className Tailwind class
 *   4. flex: 1 (share remaining space)
 *
 * Because header and body rows use the same column style function, alignment is guaranteed.
 */
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
  pagination,
  minWidth,
  enableResize = false,
  onHeaderClick,
  tableId,
}: UnifiedTableProps<T>) {
  const { settings, getDensityPadding } = useTableSettings();

  const visibleColumns = useMemo(
    () => columns.filter(c => c.visible !== false),
    [columns],
  );

  const preferenceKey = enableResize && tableId
    ? `unified_${tableId}`
    : enableResize
    ? `unified_${String(idKey)}`
    : "";

  const { columnWidths, handleResizeStart, getFlexColumnStyle, autoFitColumn } =
    useColumnResize(visibleColumns, preferenceKey);

  const cellBorderClass = getLeftBorderClass(settings.borderStyle);

  // Effective widths = resize overrides ∪ Tailwind-class-parsed widths.
  // Passed to TableSummary so summary cells align with body cells.
  const effectiveWidths = useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = { ...columnWidths };
    visibleColumns.forEach(col => {
      if (!result[col.id]) {
        const w =
          parseWidthFromClassName(col.width) ||
          parseWidthFromClassName(col.className);
        if (w) result[col.id] = w;
      }
    });
    return result;
  }, [columnWidths, visibleColumns]);

  // ── Sample values for full-content auto-fit (double-click resize handle) ──
  const getColumnSampleValues = useCallback(
    (col: UnifiedColumn<T>): string[] =>
      data
        .slice(0, 30)
        .map((row, rowIdx) =>
          typeof col.accessor === "function"
            ? getPrimitiveCellValue(col.accessor(row, rowIdx))
            : getPrimitiveCellValue(row[col.accessor] as ReactNode),
        )
        .filter(Boolean),
    [data],
  );

  // ── Double-click on resize handle → full auto-fit (header + data) ──
  const handleAutoFit = useCallback(
    (colId: string, _options?: AutoFitColumnOptions) => {
      const col = visibleColumns.find(c => c.id === colId);
      if (!col) return;
      autoFitColumn(colId, {
        headerText: getHeaderText(col),
        sampleValues: getColumnSampleValues(col),
      });
    },
    [visibleColumns, autoFitColumn, getColumnSampleValues],
  );

  // ── GridHeader columns with pre-computed flex styles ──
  const gridHeaderColumns = useMemo<GridHeaderColumn[]>(
    () =>
      visibleColumns.map(col => ({
        id: col.id,
        header: col.header,
        label: col.label || getHeaderText(col),
        align: col.align,
        width: col.width,
      })),
    [visibleColumns],
  );

  // ── All columns list (for the settings dropdown inside GridHeader) ──
  const allColumnsForSettings = useMemo(
    () =>
      columns.map(col => ({
        id: col.id,
        label: col.label || getHeaderText(col),
        visible: col.visible !== false,
      })),
    [columns],
  );

  // ── Row renderer ──
  const renderRows = () => {
    if (loading) {
      return Array.from({ length: skeletonRows }).map((_, idx) => (
        <div
          key={`skeleton-${idx}`}
          className={cn("flex animate-pulse", getRowBorderClass(settings.borderStyle))}
          dir="rtl"
        >
          {visibleColumns.map(col => (
            <div
              key={col.id}
              className={cn(getDensityPadding(), cellBorderClass)}
              style={getFlexColumnStyle(col)}
            >
              <Skeleton
                className={cn(
                  "h-3.5 rounded",
                  col.align === "left"
                    ? "mr-auto ml-0 w-3/4"
                    : col.align === "center"
                    ? "mx-auto w-1/2"
                    : "ml-auto mr-0 w-3/4",
                )}
              />
            </div>
          ))}
        </div>
      ));
    }

    if (data.length === 0) {
      return (
        <EmptyState
          message={emptyMessage}
          suggestion={emptySuggestion}
          icon={emptyIcon}
        />
      );
    }

    return data.map((row, rowIdx) => {
      const rowId = String(row[idKey] ?? rowIdx);
      const isSelected = !!(selectedId && String(selectedId) === rowId);

      return (
        <div
          key={rowId}
          dir="rtl"
          className={cn(
            "flex group transition-all duration-75",
            getRowBorderClass(settings.borderStyle),
            onRowClick && "cursor-pointer",
            getRowBackgroundClass(
              isSelected,
              rowIdx,
              settings.zebraRows,
              settings.rowHoverEffect,
            ),
          )}
          onClick={() => onRowClick?.(row)}
          onDoubleClick={() => onRowDoubleClick?.(row)}
        >
          {visibleColumns.map(col => (
            <div
              key={col.id}
              data-col-id={col.id}
              className={cn(
                getDensityPadding(),
                cellBorderClass,
                "text-slate-600 transition-colors group-hover:text-slate-900 overflow-hidden",
                col.className,
              )}
              style={{
                fontSize: `${settings.fontSize}px`,
                fontFamily: settings.fontFamily,
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                ...getFlexColumnStyle(col),
              }}
            >
              {typeof col.accessor === "function"
                ? col.accessor(row, rowIdx)
                : (row[col.accessor] as ReactNode) || "—"}
            </div>
          ))}
        </div>
      );
    });
  };

  const showSummary = !!(summary?.length && settings.showSummary && data.length > 0);

  return (
    <div className={cn("w-full h-full flex flex-col", className)}>
      {/*
       * Single scroll container.
       * The GridHeader is sticky top-0 INSIDE this container, so:
       *   – vertical scroll: header sticks at top ✓
       *   – horizontal scroll: header moves with body ✓
       */}
      <div className="flex-1 overflow-auto relative custom-scrollbar">
        <div style={minWidth ? { minWidth } : undefined}>
          {/* ── Flex Grid Header (replaces <thead>) ── */}
          <GridHeader
            columns={gridHeaderColumns}
            allColumns={allColumnsForSettings}
            onColumnToggle={() => {/* column toggling handled by TableShell toolbar */}}
            getDensityPadding={getDensityPadding}
            fontSize={settings.fontSize}
            headerColor={settings.headerColor}
            stickyHeader={settings.stickyHeader}
            borderStyle={settings.borderStyle}
            enableResize={enableResize}
            onResizeStart={enableResize ? handleResizeStart : undefined}
            onAutoFit={enableResize ? handleAutoFit : undefined}
            columnWidths={columnWidths}
            getColumnStyle={getFlexColumnStyle}
          />

          {/* ── Body rows ── */}
          {renderRows()}

          {/*
           * Summary row.
           * Placed INSIDE the scroll container so it scrolls horizontally
           * with the body. sticky=true makes it stick to the bottom of the
           * visible scroll area when the user scrolls vertically.
           */}
          {showSummary && (
            <TableSummary
              columns={summary!}
              columnWidths={effectiveWidths}
              sticky
            />
          )}
        </div>
      </div>

      {/* Pagination – outside scroll, fixed at bottom */}
      {pagination && settings.showPagination && (
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/30 px-4 py-2">
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
