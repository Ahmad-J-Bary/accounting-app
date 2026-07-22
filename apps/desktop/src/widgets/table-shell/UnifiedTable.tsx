import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
  /** Currently sorted column id (shows ↑/↓ indicator) */
  sortField?: string;
  /** Current sort direction */
  sortDirection?: 'asc' | 'desc';
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
 * - All visible columns together always fill 100% of the container width
 *   (no horizontal scroll, no trailing empty space).
 * - Header and body rows share the same `gridTemplateColumns` string for
 *   guaranteed pixel-perfect column alignment.
 * - Column widths only change via user drag-resize or double-click on the
 *   resize handle. Sorting (single-click on header) NEVER changes column
 *   width.
 * - Resizing one column shrinks the adjacent column proportionally, keeping
 *   the total width constant (N-1 resize handles).
 * - Single-click on a header cell → calls `onHeaderClick` (sorting only).
 *   Does NOT auto-fit.
 * - Double-click on a resize handle → full auto-fit of the column (header
 *   text + sample data values).
 * - Sort indicators (↑ / ↓) appear on the header cell that matches
 *   `sortField` / `sortDirection` props.
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
  sortField,
  sortDirection,
}: UnifiedTableProps<T>) {
  const { settings, getDensityPadding } = useTableSettings();

  const visibleColumns = useMemo(
    () => columns.filter(c => c.visible !== false),
    [columns],
  );

  const visibleColumnIds = useMemo(
    () => new Set(visibleColumns.map(c => c.id)),
    [visibleColumns],
  );

  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const handlePreparePrint = () => flushSync(() => setIsPrinting(true));
    const handleEndPrint = () => setIsPrinting(false);

    window.addEventListener("app:prepare-print", handlePreparePrint);
    window.addEventListener("app:end-print", handleEndPrint);
    return () => {
      window.removeEventListener("app:prepare-print", handlePreparePrint);
      window.removeEventListener("app:end-print", handleEndPrint);
    };
  }, []);

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

  const hiddenColumns = useMemo(
    () => columns.filter(c => c.visible === false),
    [columns],
  );

  const printGridTemplateColumns = useMemo(() => {
    const visibleTracks = gridTemplateColumns.split(' ').filter(t => t !== '0fr');
    const hiddenTracks = Array.from({ length: hiddenColumns.length }, () => '50px');
    return [...visibleTracks, ...hiddenTracks].join(' ');
  }, [gridTemplateColumns, hiddenColumns.length]);

  const displayGridTemplate = isPrinting ? printGridTemplateColumns : gridTemplateColumns;

  const printColumns = useMemo(() => {
    return columns.map(col => ({
      ...col,
      className: cn(col.className, !visibleColumnIds.has(col.id) && "print-collapsed"),
    }));
  }, [columns, visibleColumnIds]);

  const renderColumns = isPrinting ? printColumns : visibleColumns;

  const cellBorderClass = getLeftBorderClass(settings.borderStyle);

  // ── Single click on header → SORT ONLY (never auto-fit) ──────────────────
  const handleHeaderCellClick = useCallback(
    (colId: string) => {
      const col = visibleColumns.find(c => c.id === colId);
      if (!col) return;
      col.onHeaderClick?.(colId);
      onHeaderClick?.(col);
    },
    [visibleColumns, onHeaderClick],
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
      renderColumns.map(col => ({
        id: col.id,
        header: col.header,
        label: col.label || getHeaderText(col),
        align: col.align,
      })),
    [renderColumns],
  );

  // ── Row cell style — centered, no ellipsis. The grid column widens to
  //    fit the content; neighboring columns absorb the remaining change
  //    so total width stays constant.
  const getCellStyle = (): React.CSSProperties => ({
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
          style={{ display: "grid", gridTemplateColumns: displayGridTemplate }}
          dir="rtl"
        >
          {renderColumns.map(col => (
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
          style={{ display: "grid", gridTemplateColumns: displayGridTemplate }}
          onClick={() => onRowClick?.(row)}
          onDoubleClick={() => onRowDoubleClick?.(row)}
        >
          {renderColumns.map(col => (
              <div
                key={col.id}
                data-col-id={col.id}
                className={cn(
                  getDensityPadding(),
                  cellBorderClass,
                  "text-slate-600 transition-colors group-hover:text-slate-900",
                  col.className,
                )}
                style={getCellStyle()}
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

  const filteredSummary = useMemo(() => {
    if (!summary?.length) return undefined;
    if (isPrinting) return summary;
    return summary.filter(s => {
      if (!s.columnId) return true;
      return visibleColumnIds.has(s.columnId);
    });
  }, [summary, visibleColumnIds, isPrinting]);

  const showSummary = !!(
    filteredSummary?.length && settings.showSummary && data.length > 0
  );

  return (
    <div className={cn("w-full h-full flex flex-col", className)}>
      {/*
       * Single scroll container.
       * GridHeader is sticky top-0 INSIDE this container:
       *   – vertical scroll: header sticks at top ✓
       *   – horizontal scroll: header scrolls with body ✓  (same container)
       * The body and header both use `gridTemplateColumns`, guaranteeing
       * perfect column alignment across all rows.
       *
       * `scrollbar-gutter: stable` reserves the inline-end gutter for the
       * scrollbar even when no scroll is needed. That keeps the body's
       * content area width constant, so the page-footer summary below
       * (which sits outside the scroll container, full parent width) can
       * match it with `padding-inline-end` and stay perfectly aligned.
       */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative custom-scrollbar"
        style={{ scrollbarGutter: "stable" }}
      >
        {/* ── Flex Grid Header (sticky, CSS Grid, N-1 resize handles) ── */}
        <GridHeader
          columns={gridHeaderColumns}
          getDensityPadding={getDensityPadding}
          fontSize={settings.fontSize}
          fontFamily={settings.fontFamily}
          headerColor={settings.headerColor}
          stickyHeader={settings.stickyHeader}
          borderStyle={settings.borderStyle}
          enableResize={enableResize}
          onHeaderCellClick={handleHeaderCellClick}
          onResizeStart={enableResize ? handleResizeStart : undefined}
          onAutoFit={enableResize ? handleAutoFit : undefined}
          gridTemplate={displayGridTemplate}
          sortField={sortField}
          sortDirection={sortDirection}
        />

        {/* ── Body rows ── */}
        {renderRows()}
      </div>

      {/*
       * Page-footer summary – lives OUTSIDE the scroll container so it
       * always sits at the very bottom of the table (never scrolls with
       * the body). The inline-end padding compensates for the scrollbar
       * gutter reserved above, so the summary's content width exactly
       * matches the body's content width and every column aligns.
       */}
      {showSummary && (
        <div style={{ paddingInlineEnd: 8 }}>
          <TableSummary
            columns={filteredSummary!}
            gridTemplate={displayGridTemplate}
            asPageFooter
          />
        </div>
      )}

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
