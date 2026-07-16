import { useEntityList } from './useEntityList';

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
  const result = useEntityList<T, never>({
    queryKey,
    fetchData,
    searchFields,
    errorLabel,
    readonly: true,
    enabled,
    dependencies,
    initialSearch,
  });

  return {
    data: result.items,
    filtered: result.filtered,
    loading: result.loading,
    refreshing: result.refreshing,
    search: result.search,
    setSearch: result.setSearch,
    refresh: result.refresh,
    error: result.error,
    setData: () => {},
  };
}
