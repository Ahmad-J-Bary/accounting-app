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
  const prevDefaultRef = useRef<string[]>([]);

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

  // Reconcile when column set OR default visibility changes.
  // On column set changes: add newly added default columns, remove deleted columns.
  // On default visibility changes (e.g. baseCurrency loaded after first render):
  //   add new default columns that aren't already visible.
  // Never removes columns the user explicitly toggled on.
  // Never re-adds columns the user explicitly toggled off.
  useEffect(() => {
    const isInitialRender = prevAllIdsKeyRef.current === null;
    const columnsChanged = prevAllIdsKeyRef.current !== null && prevAllIdsKeyRef.current !== allIdsKey;
    const defaultsChanged = !isInitialRender && (
      prevDefaultRef.current.length !== defaultVisibleColumns.length ||
      !prevDefaultRef.current.every((id, i) => id === defaultVisibleColumns[i])
    );

    const prevDefaults = prevDefaultRef.current;

    prevAllIdsKeyRef.current = allIdsKey;
    prevDefaultRef.current = defaultVisibleColumns;

    if (isInitialRender) return;
    if (!columnsChanged && !defaultsChanged) return;

    setVisibleColumns(prev => {
      const allIds = new Set(allColumnIds);
      const prevSet = new Set(prev);
      const prevDefaultsSet = new Set(prevDefaults);

      const valid = prev.filter(id => allIds.has(id));

      const newIds = defaultVisibleColumns.filter(
        id => !prevSet.has(id) && allIds.has(id) && !prevDefaultsSet.has(id),
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
