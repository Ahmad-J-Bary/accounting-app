import { useState, useEffect } from "react";

export function useColumnPreferences(tableId: string, defaultVisibleColumns: string[]) {
  const getStoredPreferences = () => {
    try {
      const stored = localStorage.getItem(`table-cols-${tableId}`);
      if (stored) {
        return JSON.parse(stored) as string[];
      }
    } catch (e) {
      console.error("Failed to parse column preferences", e);
    }
    return defaultVisibleColumns;
  };

  const [visibleColumns, setVisibleColumns] = useState<string[]>(getStoredPreferences);

  useEffect(() => {
    try {
      localStorage.setItem(`table-cols-${tableId}`, JSON.stringify(visibleColumns));
    } catch (e) {
      console.error("Failed to save column preferences", e);
    }
  }, [tableId, visibleColumns]);

  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => {
      if (prev.includes(columnId)) {
        return prev.filter(id => id !== columnId);
      } else {
        return [...prev, columnId];
      }
    });
  };

  const isVisible = (columnId: string) => visibleColumns.includes(columnId);

  return {
    visibleColumns,
    setVisibleColumns,
    toggleColumn,
    isVisible
  };
}
