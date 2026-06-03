import { useCallback } from "react";
import { useColumnResize as useSharedColumnResize } from "@shared/hooks";
import type { DocumentColumn } from "./GenericDocumentGrid";

export function useColumnResize(columns: DocumentColumn[], preferenceKey: string) {
  const { columnWidths, handleResizeStart, getColumnStyle, setColumnWidths } = useSharedColumnResize(columns, preferenceKey);

  const getColumnStyleTyped = useCallback(
    (col: DocumentColumn): React.CSSProperties => getColumnStyle(col),
    [getColumnStyle],
  );

  const autoFitColumn = useCallback(
    (colKey: string, getCellValue: (line: unknown, key: string) => string, lines: unknown[], cols: DocumentColumn[]) => {
      let maxLen = 0;
      lines.forEach((line) => {
        const val = getCellValue(line, colKey);
        if (val && val.length > maxLen) maxLen = val.length;
      });
      const col = cols.find((c) => c.key === colKey);
      const headerLen = col ? col.header.length : 10;
      const estimatedWidth = Math.max(70, Math.min(400, Math.max(maxLen, headerLen) * 8.5 + 32));
      setColumnWidths({ ...columnWidths, [colKey]: estimatedWidth });
    },
    [columnWidths, setColumnWidths],
  );

  return { columnWidths, handleResizeStart, getColumnStyle: getColumnStyleTyped, autoFitColumn };
}
