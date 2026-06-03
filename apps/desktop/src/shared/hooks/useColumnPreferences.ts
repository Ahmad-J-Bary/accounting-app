import { useState, useEffect, useRef } from "react";

export function useColumnPreferences(tableId: string, defaultVisibleColumns: string[]) {
  const defaultKey = JSON.stringify(defaultVisibleColumns);
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
    setVisibleColumns(prev => {
      const defaultSet = new Set(defaultVisibleColumns);

      const filtered = prev.filter(id => defaultSet.has(id));

      const currentSet = new Set(filtered);
      const added = defaultVisibleColumns.filter(id => !currentSet.has(id));

      return added.length > 0 || filtered.length !== prev.length
        ? [...filtered, ...added]
        : prev;
    });
  }, [defaultKey, defaultVisibleColumns]);

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
