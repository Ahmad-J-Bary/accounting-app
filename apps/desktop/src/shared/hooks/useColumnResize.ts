import { useState, useRef, useCallback, useEffect } from "react";
import type { ColumnWidthDef } from "@shared/lib/table-utils";
import { parsePixelWidth, getColumnId } from "@shared/lib/table-utils";

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
      const startWidth = columnWidths[colId] || (col ? parsePixelWidth(col.width) : 100);
      resizeRef.current = { colId, startX: e.clientX, startWidth };

      const handleMouseMove = (me: MouseEvent) => {
        if (!resizeRef.current) return;
        const diff = document.dir === "rtl"
          ? resizeRef.current.startX - me.clientX
          : me.clientX - resizeRef.current.startX;
        const newWidth = Math.max(50, resizeRef.current.startWidth + diff);
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
    return () => { resizeRef.current = null; };
  }, []);

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

  return { columnWidths, handleResizeStart, getColumnStyle, setColumnWidths: setColumnWidthsState };
}
