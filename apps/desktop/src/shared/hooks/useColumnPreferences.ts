import { useState, useEffect, useRef } from "react";

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

  // Only add new columns that are in defaultVisibleColumns but not in current visibleColumns
  // DO NOT overwrite existing user preferences!
  useEffect(() => {
    setVisibleColumns(prev => {
      const defaultSet = new Set(defaultVisibleColumns);
      const currentSet = new Set(prev);
      
      // Keep only valid columns (still in default set)
      const validColumns = prev.filter(id => defaultSet.has(id));
      
      // Add any new columns from default that aren't already in validColumns
      const newColumns = defaultVisibleColumns.filter(id => !currentSet.has(id));
      
      // If nothing changed, return previous to avoid unnecessary re-renders
      const newVisible = [...validColumns, ...newColumns];
      
      if (newVisible.length === prev.length && 
          newVisible.every((id, i) => id === prev[i])) {
        return prev;
      }
      
      return newVisible;
    });
  }, [defaultVisibleColumns]);

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
