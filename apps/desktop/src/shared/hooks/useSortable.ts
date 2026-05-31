import { useState, useCallback, useMemo } from "react";

interface UseSortableOptions<T, F extends string> {
  data: T[];
  defaultField: F;
  defaultDirection?: "asc" | "desc";
  sortFn?: (a: T, b: T, field: F, direction: "asc" | "desc") => number;
}

interface UseSortableReturn<T, F extends string> {
  sortField: F;
  sortDirection: "asc" | "desc";
  setSortField: (field: F) => void;
  setSortDirection: (dir: "asc" | "desc") => void;
  handleSort: (field: F) => void;
  sortedData: T[];
}

export function useSortable<T, F extends string>({ 
  data, 
  defaultField, 
  defaultDirection = "asc",
  sortFn
}: UseSortableOptions<T, F>): UseSortableReturn<T, F> {
  const [sortField, setSortField] = useState<F>(defaultField);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultDirection);

  const handleSort = useCallback((field: F) => {
    setSortDirection(prev => {
      if (sortField === field) {
        return prev === "asc" ? "desc" : "asc";
      }
      return "asc";
    });
    setSortField(field);
  }, [sortField]);

  const sortedData = useMemo(() => {
    const sorted = [...data];
    if (sortFn) {
      sorted.sort((a, b) => sortFn(a, b, sortField, sortDirection));
    } else {
      sorted.sort((a: T, b: T) => {
        let comparison = 0;
        const aVal = a[sortField as unknown as keyof T];
        const bVal = b[sortField as unknown as keyof T];
        
        if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal;
        } else if (aVal instanceof Date && bVal instanceof Date) {
          comparison = aVal.getTime() - bVal.getTime();
        } else {
          comparison = String(aVal || "").localeCompare(String(bVal || ""), "ar");
        }
        
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }
    return sorted;
  }, [data, sortField, sortDirection, sortFn]);

  return {
    sortField,
    sortDirection,
    setSortField,
    setSortDirection,
    handleSort,
    sortedData
  };
}
