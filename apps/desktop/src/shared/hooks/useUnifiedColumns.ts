import { useMemo } from "react";
import { useColumnPreferences } from "./useColumnPreferences";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";

interface UseUnifiedColumnsOptions<T> {
  tableId: string;
  columns: UnifiedColumn<T>[];
  defaultVisible: string[];
}

interface UseUnifiedColumnsReturn<T> {
  enrichedColumns: UnifiedColumn<T>[];
  toolbarColumns: { id: string; label: string; visible: boolean }[];
  toggleColumn: (id: string) => void;
  visibleColumns: string[];
  setVisibleColumns: (cols: string[]) => void;
  resetToDefault: () => void;
  isModified: boolean;
  totalColumns: number;
  visibleCount: number;
  defaultVisible: string[];
}

export function useUnifiedColumns<T>({
  tableId,
  columns,
  defaultVisible,
}: UseUnifiedColumnsOptions<T>): UseUnifiedColumnsReturn<T> {
  const allColumnIds = useMemo(
    () => columns.map(c => c.id),
    [columns],
  );

  const {
    visibleColumns,
    toggleColumn,
    setVisibleColumns,
    resetToDefault,
    isModified,
  } = useColumnPreferences({
    tableId,
    allColumnIds,
    defaultVisibleColumns: defaultVisible,
  });

  const visibleSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);

  const enrichedColumns = useMemo(() => {
    return columns.map(col => ({
      ...col,
      visible: visibleSet.has(col.id),
    }));
  }, [columns, visibleSet]);

  const toolbarColumns = useMemo(() => {
    return columns.map(c => ({
      id: c.id,
      label: c.label || (typeof c.header === 'string' ? c.header : c.id),
      visible: visibleSet.has(c.id),
    }));
  }, [columns, visibleSet]);

  return {
    enrichedColumns,
    toolbarColumns,
    toggleColumn,
    visibleColumns,
    setVisibleColumns,
    resetToDefault,
    isModified,
    totalColumns: columns.length,
    visibleCount: visibleColumns.length,
    defaultVisible,
  };
}
