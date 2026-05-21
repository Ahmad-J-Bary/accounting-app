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
}

export function useUnifiedColumns<T>({
  tableId,
  columns,
  defaultVisible,
}: UseUnifiedColumnsOptions<T>): UseUnifiedColumnsReturn<T> {
  const { visibleColumns, toggleColumn, setVisibleColumns } = useColumnPreferences(tableId, defaultVisible);

  const enrichedColumns = useMemo(() => {
    return columns.map(col => ({
      ...col,
      visible: visibleColumns.includes(col.id),
    }));
  }, [columns, visibleColumns]);

  const toolbarColumns = useMemo(() => {
    return columns.map(c => ({
      id: c.id,
      label: c.label || (typeof c.header === 'string' ? c.header : c.id),
      visible: visibleColumns.includes(c.id),
    }));
  }, [columns, visibleColumns]);

  return {
    enrichedColumns,
    toolbarColumns,
    toggleColumn,
    visibleColumns,
    setVisibleColumns,
  };
}
