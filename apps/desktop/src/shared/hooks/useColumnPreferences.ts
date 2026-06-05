import { useState, useEffect, useRef, useMemo } from "react";

export interface UseColumnPreferencesOptions {
  tableId: string;
  /** Full list of every column id that exists in the current table */
  allColumnIds: string[];
  /** Column ids that are visible by default (a subset of allColumnIds) */
  defaultVisibleColumns: string[];
}

export function useColumnPreferences({
  tableId,
  allColumnIds,
  defaultVisibleColumns,
}: UseColumnPreferencesOptions) {
  const allIdsKey = useMemo(
    () => allColumnIds.slice().sort().join("|"),
    [allColumnIds],
  );
  const prevAllIdsKeyRef = useRef<string | null>(null);

  const defaultRef = useRef<string[]>(defaultVisibleColumns);
  defaultRef.current = defaultVisibleColumns;

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`table-cols-${tableId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is string => typeof id === "string");
        }
      }
    } catch (e) {
      console.error("Failed to parse column preferences", e);
    }
    return defaultVisibleColumns;
  });

  // Reconcile ONLY when the column set itself changes (a column was added or
  // removed from the table). Never on every render – that would clobber the
  // user's explicit hide/show choices.
  useEffect(() => {
    if (prevAllIdsKeyRef.current === null) {
      prevAllIdsKeyRef.current = allIdsKey;
      return;
    }
    if (prevAllIdsKeyRef.current === allIdsKey) return;
    prevAllIdsKeyRef.current = allIdsKey;

    setVisibleColumns(prev => {
      const allIds = new Set(allColumnIds);
      const defaultSet = new Set(defaultVisibleColumns);
      const prevSet = new Set(prev);

      const valid = prev.filter(id => allIds.has(id));
      const newIds = defaultVisibleColumns.filter(
        id => !prevSet.has(id) && allIds.has(id),
      );

      const next = [...valid, ...newIds];
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) {
        return prev;
      }
      return next;
    });
  }, [allIdsKey, allColumnIds, defaultVisibleColumns]);

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

  const resetToDefault = () => {
    setVisibleColumns(defaultRef.current);
  };

  const isVisible = (columnId: string) => visibleColumns.includes(columnId);

  const isModified = (() => {
    const cur = new Set(visibleColumns);
    const def = new Set(defaultRef.current);
    if (cur.size !== def.size) return true;
    for (const id of cur) {
      if (!def.has(id)) return true;
    }
    return false;
  })();

  return {
    visibleColumns,
    setVisibleColumns,
    toggleColumn,
    resetToDefault,
    isModified,
    isVisible
  };
}
