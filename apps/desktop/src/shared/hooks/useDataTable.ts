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
}

/**
 * A generalized hook to manage data fetching, searching, and loading states for ERP tables.
 */
export function useDataTable<T>({ 
  fetchData, 
  searchFields, 
  initialSearch = "",
  errorLabel = "خطأ في جلب البيانات"
}: UseDataTableOptions<T>) {
  const optionsRef = useRef({ fetchData, searchFields, errorLabel });
  optionsRef.current = { fetchData, searchFields, errorLabel };

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [error, setError] = useState<string | null>(null);

  const initialFetchCalledRef = useRef(false);

  const refresh = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const result = await optionsRef.current.fetchData();
      setData(result);
    } catch (e) {
      const msg = String(e);
      setError(msg);
      toast.error(`${optionsRef.current.errorLabel}: ${msg}`);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialFetchCalledRef.current) {
      initialFetchCalledRef.current = true;
      refresh();
    }
  }, [refresh]);

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
    search,
    setSearch,
    refresh,
    error,
    setData,
  }), [data, filtered, loading, search, refresh, error, setData]);
}
