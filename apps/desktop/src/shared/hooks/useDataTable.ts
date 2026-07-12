import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

interface UseDataTableOptions<T> {
  queryKey: string[];
  fetchData: () => Promise<T[]>;
  searchFields: (keyof T)[];
  initialSearch?: string;
  errorLabel?: string;
  dependencies?: unknown[];
  enabled?: boolean;
}

export function useDataTable<T>({
  queryKey,
  fetchData,
  searchFields,
  initialSearch = "",
  errorLabel = "خطأ في جلب البيانات",
  dependencies = [],
  enabled = true,
}: UseDataTableOptions<T>) {
  const [search, setSearch] = useState(initialSearch);

  const {
    data: rawData = [],
    isLoading: loading,
    isRefetching: refreshing,
    refetch,
    error,
  } = useQuery<T[]>({
    queryKey: [...queryKey, ...dependencies],
    queryFn: fetchData,
    enabled,
    meta: { errorMessage: errorLabel },
  });

  const refresh = useCallback(
    (silent = false) => {
      refetch();
    },
    [refetch]
  );

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return rawData;
    return rawData.filter((item) =>
      searchFields.some((field) => {
        const value = item[field as keyof T];
        return value && String(value).toLowerCase().includes(s);
      })
    );
  }, [rawData, search, searchFields]);

  return useMemo(
    () => ({
      data: rawData,
      filtered,
      loading,
      refreshing,
      search,
      setSearch,
      refresh,
      error: error ? String(error) : null,
      setData: () => {},
    }),
    [rawData, filtered, loading, refreshing, search, refresh, error]
  );
}
