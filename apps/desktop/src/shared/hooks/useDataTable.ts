import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

interface UseDataTableOptions<T> {
  /**
   * Function to fetch data from the service
   */
  fetchData: () => Promise<T[]>;
  /**
   * Fields to search in (case-insensitive)
   */
  searchFields: (keyof T)[];
  /**
   * Optional initial search term
   */
  initialSearch?: string;
  /**
   * Custom error message
   */
  errorLabel?: string;
  /**
   * Dependencies that trigger a re-fetch
   */
  dependencies?: unknown[];
}

/**
 * A generalized hook to manage data fetching, searching, and loading states for ERP tables.
 */
export function useDataTable<T>({ 
  fetchData, 
  searchFields, 
  initialSearch = "",
  errorLabel = "خطأ في جلب البيانات",
  dependencies = []
}: UseDataTableOptions<T>) {
  const optionsRef = useRef({ fetchData, searchFields, errorLabel });
  optionsRef.current = { fetchData, searchFields, errorLabel };

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [error, setError] = useState<string | null>(null);

  const initialFetchCalledRef = useRef(false);
  const activeRequestRef = useRef<number>(0);

  const refresh = useCallback(async (silent = false) => {
    const requestId = ++activeRequestRef.current;
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const result = await optionsRef.current.fetchData();
      
      // Only update if this is the most recent request
      if (requestId === activeRequestRef.current) {
        setData(result);
      }
    } catch (e) {
      if (requestId === activeRequestRef.current) {
        const msg = String(e);
        setError(msg);
        toast.error(`${optionsRef.current.errorLabel}: ${msg}`);
      }
    } finally {
      if (requestId === activeRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!initialFetchCalledRef.current) {
      initialFetchCalledRef.current = true;
      refresh();
    }
  }, [refresh]);

  // Re-fetch when dependencies change
  const lastDepsRef = useRef<unknown[]>(dependencies);
  
  useEffect(() => {
    const depsChanged = dependencies.length !== lastDepsRef.current.length || 
                        dependencies.some((d, i) => d !== lastDepsRef.current[i]);
    
    if (depsChanged && initialFetchCalledRef.current) {
      lastDepsRef.current = dependencies;
      refresh(true);
    }
  }, [refresh, dependencies]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return data;
    
    const fields = optionsRef.current.searchFields;
    return data.filter((item) =>
      fields.some((field) => {
        const value = item[field as keyof T];
        return value && String(value).toLowerCase().includes(s);
      })
    );
  }, [data, search]);

  return useMemo(() => ({
    data,
    filtered,
    loading,
    refreshing,
    search,
    setSearch,
    refresh,
    error,
    setData,
  }), [data, filtered, loading, refreshing, search, refresh, error, setData]);
}
