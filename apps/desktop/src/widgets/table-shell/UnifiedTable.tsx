import React, { ReactNode, useCallback, useMemo, useRef } from "react";
import { cn } from '@shared/lib/utils';
import { Skeleton } from "@shared/ui/skeleton";
import { useTableSettings, useGridResize } from "@shared/hooks";
import { getRowBackgroundClass, getRowBorderClass, getLeftBorderClass } from "@shared/lib/table-utils";
import type { SummaryColumn } from './TableSummary';
import { TableSummary } from './TableSummary';
import { TablePagination } from './TablePagination';
import { EmptyState } from './EmptyState';
import { GridHeader } from './GridHeader';
import type { GridResizeOptions } from '@shared/hooks/useGridResize';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UnifiedColumn<T> {
  id: string;
  header: ReactNode;
  /** Plain-text label used in dropdowns and auto-fit text measurement */
  label?: string;
  accessor: keyof T | ((row: T, index: number) => ReactNode);
  /** Extra CSS classes applied to body cells */
  className?: string;
  headerClassName?: string;
  align?: "right" | "left" | "center";
  visible?: boolean;
  /** Tailwind width class (kept for backward-compat, not used in grid layout) */
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
  /** Summary row – one SummaryColumn per visible column (empty value = spacer) */
  summary?: SummaryColumn[];
  /** @deprecated – not needed in grid layout */
  summaryColSpan?: number;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    pageSize?: number;
  };
  /** @deprecated – grid layout fills container automatically; no min-width needed */
  minWidth?: string;
  /** Enable per-column resize handles + click-to-fit */
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
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UnifiedTable – The single table primitive for the desktop app.
 *
 * Layout: CSS Grid (no <table> element).
 *
 * Key behaviors:
 * - Header and every body row share the same `gridTemplateColumns`, so
 *   column alignment is guaranteed without a <table>.
 * - All columns together always fill 100% of the container width (no
 *   horizontal scroll, no trailing empty space).
 * - Resizing a column proportionally shrinks the adjacent column so the
 *   total width stays constant.
 * - N-1 resize handles: handles appear BETWEEN columns only, not after
 *   the last column.
 * - Single-click header → expand column to fit header label text.
 * - Double-click resize handle → full auto-fit (header + sample data).
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

  // Single ref spans both GridHeader cells and body row cells (same container)
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Sample data values for full auto-fit ──────────────────────────────────
  // Used to derive each column's min-content width so the column itself
  // expands to show the full text instead of clipping with "...".
  const getColumnSampleValues = useCallback(
    (col: UnifiedColumn<T>): string[] =>
      data
        .slice(0, 30)
        .map((row, idx) =>
          typeof col.accessor === "function"
            ? getPrimitiveCellValue(col.accessor(row, idx))
            : getPrimitiveCellValue(row[col.accessor] as ReactNode),
        )
        .filter(Boolean),
    [data],
  );

  // ── Content map: header + sample values per column ───────────────────────
  // Fed into useGridResize so every track is `minmax(minPx, Xfr)` — the
  // column can never shrink below the width needed for its widest content.
  const contentByColumn = useMemo(() => {
    const out: Record<string, { headerText: string; sampleValues: string[] }> = {};
    for (const col of visibleColumns) {
      out[col.id] = {
        headerText: getHeaderText(col),
        sampleValues: getColumnSampleValues(col),
      };
    }
    return out;
  }, [visibleColumns, getColumnSampleValues]);

  const { gridTemplateColumns, handleResizeStart, autoFitColumn } = useGridResize(
    visibleColumns,
    preferenceKey,
    containerRef,
    contentByColumn,
    settings.fontSize,
  );

  const cellBorderClass = getLeftBorderClass(settings.borderStyle);

  // ── Single click on header → title-fit ───────────────────────────────────
  const handleHeaderCellClick = useCallback(
    (colId: string) => {
      const col = visibleColumns.find(c => c.id === colId);
      if (!col) return;
      col.onHeaderClick?.(colId);
      onHeaderClick?.(col);
      if (enableResize) {
        autoFitColumn(colId, { headerText: getHeaderText(col) });
      }
    },
    [visibleColumns, onHeaderClick, enableResize, autoFitColumn],
  );

  // ── Double-click handle → full auto-fit (header + data) ──────────────────
  const handleAutoFit = useCallback(
    (colId: string, _opts?: GridResizeOptions) => {
      const col = visibleColumns.find(c => c.id === colId);
      if (!col) return;
      autoFitColumn(colId, {
        headerText: getHeaderText(col),
        sampleValues: getColumnSampleValues(col),
      });
    },
    [visibleColumns, autoFitColumn, getColumnSampleValues],
  );

  // ── GridHeader columns ────────────────────────────────────────────────────
  const gridHeaderColumns = useMemo(
    () =>
      visibleColumns.map(col => ({
        id: col.id,
        header: col.header,
        label: col.label || getHeaderText(col),
        align: col.align,
      })),
    [visibleColumns],
  );

  // ── Row cell style — centered, no ellipsis. The grid column widens to
  //    fit the content (text or icon); neighboring columns absorb the
  //    remaining change so total width stays constant.
  const getCellStyle = (col: UnifiedColumn<T>): React.CSSProperties => ({
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: `${settings.fontSize}px`,
    fontFamily: settings.fontFamily,
  });

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderRows = () => {
    if (loading) {
      return Array.from({ length: skeletonRows }).map((_, idx) => (
        <div
          key={`skeleton-${idx}`}
          className={cn("animate-pulse", getRowBorderClass(settings.borderStyle))}
          style={{ display: "grid", gridTemplateColumns }}
          dir="rtl"
        >
          {visibleColumns.map(col => (
            <div
              key={col.id}
              className={cn(getDensityPadding(), cellBorderClass)}
              style={{ minWidth: 0 }}
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
            "group transition-all duration-75",
            getRowBorderClass(settings.borderStyle),
            onRowClick && "cursor-pointer",
            getRowBackgroundClass(isSelected, rowIdx, settings.zebraRows, settings.rowHoverEffect),
          )}
          style={{ display: "grid", gridTemplateColumns }}
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
                "text-slate-600 transition-colors group-hover:text-slate-900",
                col.className,
              )}
              style={getCellStyle(col)}
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
       * GridHeader is sticky top-0 INSIDE this container:
       *   – vertical scroll: header sticks at top ✓
       *   – horizontal scroll: header scrolls with body ✓  (same container)
       * The body and header both use `gridTemplateColumns`, guaranteeing
       * perfect column alignment across all rows.
       */}
      <div ref={containerRef} className="flex-1 overflow-auto relative custom-scrollbar">
        {/* ── Flex Grid Header (sticky, CSS Grid, N-1 resize handles) ── */}
        <GridHeader
          columns={gridHeaderColumns}
          getDensityPadding={getDensityPadding}
          fontSize={settings.fontSize}
          headerColor={settings.headerColor}
          stickyHeader={settings.stickyHeader}
          borderStyle={settings.borderStyle}
          enableResize={enableResize}
          onHeaderCellClick={handleHeaderCellClick}
          onResizeStart={enableResize ? handleResizeStart : undefined}
          onAutoFit={enableResize ? handleAutoFit : undefined}
          gridTemplate={gridTemplateColumns}
        />

        {/* ── Body rows ── */}
        {renderRows()}

        {/*
         * Summary row – inside the scroll container so it scrolls
         * horizontally with the body and sticks to the bottom vertically.
         */}
        {showSummary && (
          <TableSummary
            columns={summary!}
            gridTemplate={gridTemplateColumns}
            sticky
          />
        )}
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
