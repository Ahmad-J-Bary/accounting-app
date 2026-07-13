import { useState, useRef, useCallback, useEffect, useMemo, RefObject } from 'react';
import { getColumnId } from '@shared/lib/table-utils';
import type { ColumnWidthDef } from '@shared/lib/table-utils';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MIN_COL_PX = 48;
/** Base font-family used for canvas text measurement. Font size is injected
 *  dynamically based on the table's fontSize setting so the measured width
 *  matches the actual rendered width of headers and data cells. */
const AUTO_FIT_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
/** Small padding around the measured text — just enough to keep the cell from
 *  hugging the glyphs. The column will still allow the header to wrap to
 *  2 lines when the container is narrower than the sum of min widths. */
const AUTO_FIT_PADDING = 16;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildFontString(fontSizePx: number): string {
  return `600 ${fontSizePx}px ${AUTO_FIT_FONT_FAMILY}`;
}

function measureText(text: string, fontSizePx: number): number {
  if (!text) return 0;
  if (typeof document === 'undefined') return text.length * fontSizePx * 0.6;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * fontSizePx * 0.6;
  ctx.font = buildFontString(fontSizePx);
  return Math.ceil(ctx.measureText(text).width);
}

function getColElement(
  container: HTMLElement | null,
  colId: string,
): HTMLElement | null {
  return (
    container?.querySelector<HTMLElement>(`[data-col-id="${colId}"]`) ?? null
  );
}

/** Plain-text extractor that mirrors the UnifiedTable / GridHeader behavior:
 *  header > label > id/key. Used when measuring the minimum width of a
 *  column so that any plain-text version of the header can be sized without
 *  having to render the React node. */
function readColumnLabel(col: ColumnWidthDef): string {
  if (!col) return '';
  const c = col as unknown as { header?: unknown; label?: unknown; id?: unknown; key?: unknown };
  if (typeof c.header === 'string') return c.header;
  if (typeof c.label === 'string') return c.label;
  if (typeof c.id === 'string') return c.id;
  if (typeof c.key === 'string') return c.key;
  return '';
}

function readSampleValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface GridResizeOptions {
  headerText?: string;
  sampleValues?: Array<string | number | null | undefined>;
}

/**
 * Optional content descriptor per column. When supplied, the hook grows
 * every column to fit the widest piece of content inside it, so that
 * text never gets clipped with "..." — the column itself expands to
 * show the full string.
 */
export interface GridResizeContent {
  headerText: string;
  sampleValues?: Array<string | number | null | undefined>;
}

/**
 * useGridResize – stable CSS Grid resize for tables.
 *
 * FEATURES:
 *  - All columns always fill 100% of the container (fr + fixed px, no trailing space)
 *  - Dragging the handle between col[i] and col[i+1] grows one and shrinks the other
 *  - Only the two resized columns change; all other columns remain completely stable
 *  - Resized columns get fixed pixel widths; untouched columns use 1fr
 *  - Persisted in localStorage under `${preferenceKey}_grid_px`
 *
 * ALIGNMENT GUARANTEE:
 *  Header and body rows receive the same `gridTemplateColumns` string, so
 *  every column in every row is perfectly aligned via CSS Grid.
 *
 * USAGE IN UnifiedTable:
 *  ```
 *  const containerRef = useRef<HTMLDivElement>(null);
 *  const { gridTemplateColumns, handleResizeStart, autoFitColumn } =
 *    useGridResize(visibleColumns, preferenceKey, containerRef);
 *
 *  // Apply to header:
 *  <GridHeader gridTemplate={gridTemplateColumns} ... />
 *
 *  // Apply to each body row:
 *  <div style={{ display: 'grid', gridTemplateColumns }}>...</div>
 *  ```
 */
export function useGridResize(
  columns: ColumnWidthDef[],
  preferenceKey: string,
  containerRef: RefObject<HTMLElement | null>,
  /**
   * Optional map of column-id → content descriptor (header + sample values).
   * When provided, the hook auto-grows each column to its widest piece of
   * content, so headers/data never get clipped with "..." — the column
   * itself expands to show the full text.
   */
  contentByColumn?: Record<string, GridResizeContent>,
  /**
   * Font size (in px) used for canvas text measurement.
   * Defaults to 12. Should match the table's actual font size for accurate
   * minimum-width calculation. A value of `settings.fontSize` works well
   * since headers render at ~fontSize-2 and body at fontSize.
   */
  fontSize?: number,
) {
  const measurePx = fontSize || 12;
  // Fixed pixel widths per column id for explicitly-resized columns.
  // Columns not in this map get `1fr` (equal share of remaining space).
  // Only the two columns involved in a resize get fixed pixel widths;
  // all other columns stay as `1fr` and are completely unaffected.
  const [fixedWidths, setFixedWidths] = useState<Record<string, number>>(() => {
    if (!preferenceKey) return {};
    try {
      const saved = localStorage.getItem(`${preferenceKey}_grid_px`);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {};
  });

  // Remove legacy `_grid_fr` data on first mount if present
  useEffect(() => {
    if (!preferenceKey) return;
    try {
      localStorage.removeItem(`${preferenceKey}_grid_fr`);
    } catch { /* ignore */ }
  }, [preferenceKey]);

  // Persist to localStorage whenever fixedWidths change
  useEffect(() => {
    if (!preferenceKey) return;
    try {
      if (Object.keys(fixedWidths).length > 0) {
        localStorage.setItem(`${preferenceKey}_grid_px`, JSON.stringify(fixedWidths));
      } else {
        localStorage.removeItem(`${preferenceKey}_grid_px`);
      }
    } catch { /* ignore */ }
  }, [fixedWidths, preferenceKey]);

  // ── Compute the minimum content width (in px) for each column ───────────
  // Used as a floor in minmax(minPx, Xfr). The min is deliberately set to
  // ~half the widest piece of content (with a hard floor of MIN_COL_PX) so
  // the column is allowed to compress to a width where the header text
  // *must* wrap to 2 lines to show fully — instead of always having so
  // much padding that the text always fits on a single line.
  //
  // Behavior:
  //   - Column at min     → header wraps to 2 lines (full text visible)
  //   - Column at content → header fits on 1 line (no wrapping)
  //   - User drags between min and content → smooth wrap/un-wrap transition
  //
  // The auto-fit (single click) still sets the column to the full content
  // width so the header returns to 1 line.
  const minContentPx = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const col of columns) {
      const colId = getColumnId(col);
      const supplied = contentByColumn?.[colId];
      const texts: string[] = [];
      const headerFromCol = readColumnLabel(col);
      if (supplied?.headerText) texts.push(supplied.headerText);
      else if (headerFromCol) texts.push(headerFromCol);
      if (supplied?.sampleValues) {
        for (const v of supplied.sampleValues) {
          const s = readSampleValue(v);
          if (s) texts.push(s);
        }
      }
      if (texts.length === 0) {
        out[colId] = MIN_COL_PX;
        continue;
      }
      const maxTextWidth = texts.reduce(
        (max, t) => Math.max(max, measureText(t, measurePx)),
        0,
      );
      // Floor = ~half the content width → forces the header to wrap to
      // 2 lines when the column is compressed to its min, so the full
      // text remains visible (no "..." clipping).
      // The line-height (leading-tight ≈ 1.25) is accounted for: at
      // half-width, ~2 lines can fit the full text.
      out[colId] = Math.max(
        MIN_COL_PX,
        Math.ceil(maxTextWidth * 0.5 + AUTO_FIT_PADDING),
      );
    }
    return out;
  }, [columns, contentByColumn, measurePx]);

  // ── Build the CSS grid-template-columns string ──────────────────────────
  // Columns with an explicit fixedWidths entry get a fixed pixel column
  // (`minmax(minPx, Xpx)`) — they never change unless explicitly resized.
  // Untouched columns use `1fr` (equal share of remaining space) so they
  // remain stable when other columns are resized. Only the two columns
  // involved in a resize (A and its neighbor B) get new fixed widths; all
  // other columns stay as `1fr` and are completely unaffected.
  const gridTemplateColumns = useMemo(() => {
    return columns
      .map((col) => {
        const colId = getColumnId(col);
        const px = fixedWidths[colId];
        const minPx = minContentPx[colId] ?? MIN_COL_PX;
        if (px !== undefined && px > 0) {
          return `minmax(${minPx}px, ${px}px)`;
        }
        return `minmax(${minPx}px, 1fr)`;
      })
      .join(' ');
  }, [columns, fixedWidths, minContentPx]);

  // ── Resize state ─────────────────────────────────────────────────────────
  const resizeRef = useRef<{
    colId: string;
    neighborId: string;
    startX: number;
    startWidthA: number;
    startWidthB: number;
  } | null>(null);

  useEffect(() => () => { resizeRef.current = null; }, []);

  // ── handleResizeStart ────────────────────────────────────────────────────
  /**
   * Begin a proportional resize between col[colIndex] and col[colIndex+1].
   * Called from the resize handle rendered BEFORE the last column.
   *
   * The minimum width for each column is enforced by `minContentPx` so the
   * column never shrinks below the width needed to show its content.
   *
   * RTL-aware: moving the mouse LEFT increases the column width in RTL layout.
   */
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colId: string) => {
      e.preventDefault();
      e.stopPropagation();

      const colIndex = columns.findIndex((c) => getColumnId(c) === colId);
      // Only handle non-last columns (N-1 rule enforced here too)
      if (colIndex < 0 || colIndex >= columns.length - 1) return;

      const neighborId = getColumnId(columns[colIndex + 1]);
      const container = containerRef.current;

      // Measure actual pixel widths from DOM for accurate delta calculation
      const colEl = getColElement(container, colId);
      const neighborEl = getColElement(container, neighborId);
      const startWidthA = colEl?.getBoundingClientRect().width ?? 100;
      const startWidthB = neighborEl?.getBoundingClientRect().width ?? 100;
      const minA = minContentPx[colId] ?? MIN_COL_PX;
      const minB = minContentPx[neighborId] ?? MIN_COL_PX;

      resizeRef.current = {
        colId,
        neighborId,
        startX: e.clientX,
        startWidthA,
        startWidthB,
      };

      const onMouseMove = (me: MouseEvent) => {
        if (!resizeRef.current) return;
        // ⚠️  Capture ALL needed values SYNCHRONOUSLY here.
        // setFractions runs its callback asynchronously; by then
        // resizeRef.current might already be null (mouseup cleared it).
        const { startX, startWidthA: wa, startWidthB: wb, colId, neighborId } =
          resizeRef.current;

        // RTL: moving left (negative Δ in clientX) → column gets wider
        const delta =
          document.dir === 'rtl' ? startX - me.clientX : me.clientX - startX;

        const newWidthA = Math.max(minA, wa + delta);
        const actualDelta = newWidthA - wa;
        const newWidthB = Math.max(minB, wb - actualDelta);

        // Store pixel widths directly as fixed pixel values.
        // Only column A and its neighbor B get fixed widths; all other
        // columns stay as 1fr and are completely unaffected.
        setFixedWidths((prev) => ({
          ...prev,
          [colId]: newWidthA,
          [neighborId]: newWidthB,
        }));
      };

      const onMouseUp = () => {
        resizeRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [columns, containerRef, minContentPx],
  );

  // ── autoFitColumn ────────────────────────────────────────────────────────
  /**
   * Auto-fit a column to its content width, compensating from the neighbor.
   * Both the target column and the neighbor get fixed pixel widths so all
   * other columns (using 1fr) remain completely stable.
   *
   * - Single click on header → pass only headerText (title-fit)
   * - Double-click on resize handle → pass headerText + sampleValues (full-fit)
   *
   * The neighbor is shrunk down to its content-derived minimum (from
   * `minContentPx`) so the total width stays constant without clipping
   * any column.
   */
  const autoFitColumn = useCallback(
    (colId: string, options: GridResizeOptions = {}) => {
      const texts = [
        options.headerText || colId,
        ...(options.sampleValues?.map((v) => String(v ?? '')) ?? []),
      ].filter(Boolean);

      const maxTextWidth = texts.reduce(
        (max, t) => Math.max(max, measureText(t, measurePx)),
        0,
      );
      const measuredTarget = Math.max(
        MIN_COL_PX,
        maxTextWidth + AUTO_FIT_PADDING,
      );
      // Never shrink below the content-derived floor
      const targetWidth = Math.max(
        measuredTarget,
        minContentPx[colId] ?? MIN_COL_PX,
      );

      const container = containerRef.current;
      const colIndex = columns.findIndex((c) => getColumnId(c) === colId);
      const colEl = getColElement(container, colId);
      const currentWidth = colEl?.getBoundingClientRect().width ?? 100;
      const delta = targetWidth - currentWidth;

      if (Math.abs(delta) < 1) return; // no meaningful change

      // Compensate from neighbor (prefer right neighbor, fall back to left)
      const neighborId =
        colIndex < columns.length - 1
          ? getColumnId(columns[colIndex + 1])
          : colIndex > 0
          ? getColumnId(columns[colIndex - 1])
          : null;

      if (!neighborId) {
        setFixedWidths((prev) => ({ ...prev, [colId]: targetWidth }));
        return;
      }

      const neighborEl = getColElement(container, neighborId);
      const neighborWidth = neighborEl?.getBoundingClientRect().width ?? 100;
      const neighborFloor = minContentPx[neighborId] ?? MIN_COL_PX;
      const newNeighborWidth = Math.max(neighborFloor, neighborWidth - delta);

      setFixedWidths((prev) => ({
        ...prev,
        [colId]: targetWidth,
        [neighborId]: newNeighborWidth,
      }));
    },
    [columns, containerRef, minContentPx, measurePx],
  );

  // ── resetWidths ──────────────────────────────────────────────────────────
  const resetWidths = useCallback(() => {
    setFixedWidths({});
    if (preferenceKey) {
      try {
        localStorage.removeItem(`${preferenceKey}_grid_px`);
      } catch { /* ignore */ }
    }
  }, [preferenceKey]);

  return {
    /** The CSS `grid-template-columns` value – apply to header and every body row */
    gridTemplateColumns,
    /** Start a proportional drag-resize between column[colId] and its right neighbor */
    handleResizeStart,
    /** Auto-fit a column to its text content, compensating from the neighbor */
    autoFitColumn,
    /** Reset all column widths to equal distribution */
    resetWidths,
  };
}
