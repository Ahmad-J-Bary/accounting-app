import { useCallback, useMemo } from "react";
import { useGridResize, useTableSettings } from "@shared/hooks";
import type { DocumentColumn } from "./GenericDocumentGrid";
import type { GridHeaderColumn } from "@widgets/table-shell/GridHeader";

export function useColumnResize(
  columns: DocumentColumn[],
  preferenceKey: string,
  containerRef: React.RefObject<HTMLDivElement>,
  contentByColumn?: Record<string, { headerText: string; sampleValues: string[] }>,
) {
  const { settings } = useTableSettings();

  const gridHeaderColumns: GridHeaderColumn[] = useMemo(
    () =>
      columns.map((col) => ({
        id: col.key,
        header: col.header,
        label: col.header,
        align: col.align,
        width: col.width,
      })),
    [columns],
  );

  const { gridTemplateColumns, handleResizeStart, autoFitColumn: sharedAutoFit } =
    useGridResize(
      gridHeaderColumns,
      preferenceKey,
      containerRef,
      contentByColumn,
      settings.fontSize,
    );

  const autoFitColumn = useCallback(
    (colKey: string, opts?: { headerText?: string; sampleValues?: Array<string | number | null | undefined> }) => {
      sharedAutoFit(colKey, opts);
    },
    [sharedAutoFit],
  );

  return { gridTemplateColumns, gridHeaderColumns, handleResizeStart, autoFitColumn };
}
