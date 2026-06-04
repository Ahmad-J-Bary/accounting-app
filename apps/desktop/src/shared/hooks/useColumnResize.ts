import { useState, useRef, useCallback, useEffect } from "react";
import type { ColumnWidthDef } from "@shared/lib/table-utils";
import { parsePixelWidth, parseWidthFromClassName, getColumnId } from "@shared/lib/table-utils";

const DEFAULT_COLUMN_WIDTH = 100;
const MIN_RESIZE_WIDTH = 50;
const MIN_AUTO_FIT_WIDTH = 80;
const MAX_AUTO_FIT_WIDTH = 560;
const AUTO_FIT_PADDING = 40;
const AUTO_FIT_FONT =
  '600 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export interface AutoFitColumnOptions {
  headerText?: string;
  sampleValues?: Array<string | number | null | undefined>;
  minWidth?: number;
  maxWidth?: number;
  extraPadding?: number;
  font?: string;
  expandOnly?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeMeasuredText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function measureTextWidth(text: string, font: string): number {
  if (!text) return 0;
  if (typeof document === "undefined") return Math.ceil(text.length * 9.5);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return Math.ceil(text.length * 9.5);
  context.font = font;
  return Math.ceil(context.measureText(text).width);
}

export function useColumnResize(columns: ColumnWidthDef[], preferenceKey: string) {
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>(() => {
    if (preferenceKey) {
      try {
        const saved = localStorage.getItem(`${preferenceKey}_column_widths`);
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return {};
  });

  useEffect(() => {
    if (preferenceKey && Object.keys(columnWidths).length > 0) {
      try {
        localStorage.setItem(`${preferenceKey}_column_widths`, JSON.stringify(columnWidths));
      } catch { /* ignore */ }
    }
  }, [columnWidths, preferenceKey]);

  const resizeRef = useRef<{
    colId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const col = columns.find((c) => getColumnId(c) === colId);
      const startWidth =
        columnWidths[colId] || (col ? parsePixelWidth(col.width) : DEFAULT_COLUMN_WIDTH);
      resizeRef.current = { colId, startX: e.clientX, startWidth };

      const handleMouseMove = (me: MouseEvent) => {
        if (!resizeRef.current) return;
        const diff =
          document.dir === "rtl"
            ? resizeRef.current.startX - me.clientX
            : me.clientX - resizeRef.current.startX;
        const newWidth = Math.max(MIN_RESIZE_WIDTH, resizeRef.current.startWidth + diff);
        setColumnWidthsState((prev) => ({ ...prev, [colId]: newWidth }));
      };

      const handleMouseUp = () => {
        resizeRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [columns, columnWidths],
  );

  useEffect(() => {
    return () => {
      resizeRef.current = null;
    };
  }, []);

  /**
   * Style for document-shell flex layout.
   * Uses col.width Tailwind CSS class as primary sizing; overrides with pixel value when resized.
   */
  const getColumnStyle = useCallback(
    (col: ColumnWidthDef): React.CSSProperties => {
      const colId = getColumnId(col);
      const override = columnWidths[colId];
      const base: React.CSSProperties = { textAlign: col.align || "right" };
      if (override) {
        base.width = `${override}px`;
        base.flex = "none";
      }
      return base;
    },
    [columnWidths],
  );

  /**
   * Style for the flex-based UnifiedTable layout (no <table> element).
   *
   * Width resolution priority:
   *   1. User resize override (columnWidths state)
   *   2. col.width prop (Tailwind class, e.g. "w-[80px]")
   *   3. col.className (Tailwind class, e.g. "w-[80px] text-right")
   *   4. Default: flex:1 — grows to fill remaining space
   *
   * Both header cells and body cells use this same function,
   * which guarantees perfect column alignment without needing a <table>.
   */
  const getFlexColumnStyle = useCallback(
    (col: ColumnWidthDef): React.CSSProperties => {
      const colId = getColumnId(col);
      const textAlign = (col.align || "right") as React.CSSProperties["textAlign"];
      const base: React.CSSProperties = { textAlign, overflow: "hidden", minWidth: 0 };

      // 1. User-resize override
      if (columnWidths[colId]) {
        return { ...base, width: `${columnWidths[colId]}px`, flex: "none" };
      }
      // 2. Explicit width from col.width prop
      const widthFromProp = parseWidthFromClassName(col.width);
      if (widthFromProp) {
        return { ...base, width: `${widthFromProp}px`, flex: "none" };
      }
      // 3. Width parsed from col.className
      const widthFromClass = parseWidthFromClassName(col.className);
      if (widthFromClass) {
        return { ...base, width: `${widthFromClass}px`, flex: "none" };
      }
      // 4. No explicit width → distribute remaining space equally
      return { ...base, flex: 1 };
    },
    [columnWidths],
  );

  /**
   * Build a CSS grid-template-columns value from visible columns.
   * Each column gets either a fixed pixel width (resize override or Tailwind class)
   * or 1fr if no explicit width.
   */
  const buildGridTemplate = useCallback(
    (visibleCols: ColumnWidthDef[], extras?: { prefix?: string; suffix?: string }): string => {
      const parts: string[] = [];
      if (extras?.prefix) parts.push(extras.prefix);

      for (const col of visibleCols) {
        const colId = getColumnId(col);
        const override = columnWidths[colId];
        if (override) {
          parts.push(`${override}px`);
          continue;
        }
        const parsed = parseWidthFromClassName(col.width) || parseWidthFromClassName(col.className);
        if (parsed) {
          parts.push(`${parsed}px`);
          continue;
        }
        parts.push("1fr");
      }

      if (extras?.suffix) parts.push(extras.suffix);
      return parts.join(" ");
    },
    [columnWidths],
  );

  const autoFitColumn = useCallback(
    (colId: string, options: string | AutoFitColumnOptions = {}) => {
      const col = columns.find((c) => getColumnId(c) === colId);
      const resolvedOptions =
        typeof options === "string" ? { headerText: options } : options;

      const measuredTexts = [
        resolvedOptions.headerText || getColumnId(col || { id: colId }) || colId,
        ...(resolvedOptions.sampleValues || []),
      ]
        .map((value) => normalizeMeasuredText(value))
        .filter(Boolean);

      const minWidth = Math.max(MIN_AUTO_FIT_WIDTH, resolvedOptions.minWidth ?? MIN_AUTO_FIT_WIDTH);
      const maxWidth = resolvedOptions.maxWidth ?? MAX_AUTO_FIT_WIDTH;
      const fallbackWidth =
        columnWidths[colId] ||
        (col ? parsePixelWidth(col.width) : DEFAULT_COLUMN_WIDTH);

      if (measuredTexts.length === 0) {
        setColumnWidthsState((prev) => ({ ...prev, [colId]: fallbackWidth }));
        return;
      }

      const contentWidth = measuredTexts.reduce((max, text) => {
        return Math.max(max, measureTextWidth(text, resolvedOptions.font || AUTO_FIT_FONT));
      }, 0);

      const measuredWidth = clamp(
        contentWidth + (resolvedOptions.extraPadding ?? AUTO_FIT_PADDING),
        minWidth,
        maxWidth,
      );
      const nextWidth = resolvedOptions.expandOnly === false
        ? measuredWidth
        : Math.max(fallbackWidth, measuredWidth);

      setColumnWidthsState((prev) => ({ ...prev, [colId]: nextWidth }));
    },
    [columns, columnWidths],
  );

  return {
    columnWidths,
    handleResizeStart,
    getColumnStyle,
    getFlexColumnStyle,
    buildGridTemplate,
    setColumnWidths: setColumnWidthsState,
    autoFitColumn,
  };
}
