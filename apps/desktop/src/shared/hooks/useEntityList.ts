import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

interface UseEntityListProps<T, Req> {
  fetchData: () => Promise<T[]>;
  saveData: (payload: Req) => Promise<T>;
  deleteData: (id: string) => Promise<void>;
  searchFields: (keyof T)[];
  errorLabel?: string;
  successLabel?: string;
}

/**
 * Standardized hook for managing entity lists (Customers, Suppliers, Materials, etc.).
 */
export function useEntityList<T extends { id: string }, Req>({
  fetchData,
  saveData,
  deleteData,
  searchFields,
  errorLabel = "فشل تحميل البيانات",
  successLabel = "تم الحفظ بنجاح",
}: UseEntityListProps<T, Req>) {
  const propsRef = useRef({ fetchData, saveData, deleteData, searchFields, errorLabel, successLabel });
  propsRef.current = { fetchData, saveData, deleteData, searchFields, errorLabel, successLabel };

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<T | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const activeRequestRef = useRef<number>(0);

  const refresh = useCallback(async (silent = false) => {
    const requestId = ++activeRequestRef.current;
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const data = await propsRef.current.fetchData();
      
      if (requestId === activeRequestRef.current) {
        setItems(data);
      }
    } catch (e) {
      if (requestId === activeRequestRef.current) {
        toast.error(propsRef.current.errorLabel + ": " + e);
      }
    } finally {
      if (requestId === activeRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const initialFetchRef = useRef(false);
  useEffect(() => { 
    if (!initialFetchRef.current) {
      initialFetchRef.current = true;
      refresh(); 
    }
  }, [refresh]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return items;
    
    return items.filter(item => 
      propsRef.current.searchFields.some(field => {
        const val = item[field];
        return val && String(val).toLowerCase().includes(s);
      })
    );
  }, [items, search]);

  const selectedItem = useMemo(() => 
    items.find(i => i.id === selectedId) || null,
  [items, selectedId]);

  const handleOpenAdd = useCallback(() => {
    setEditItem(null);
    setSelectedId(null);
    setIsFormOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: T) => {
    setEditItem(item);
    setIsFormOpen(true);
  }, []);

  const handleSave = useCallback(async (payload: Req) => {
    setSaving(true);
    try {
      await propsRef.current.saveData(payload);
      toast.success(propsRef.current.successLabel);
      setIsFormOpen(false);
      refresh(true);
    } catch (e) {
      console.error("[useEntityList] Save Error:", e);
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await propsRef.current.deleteData(id);
      toast.success("تم الحذف بنجاح");
      if (selectedId === id) setSelectedId(null);
      refresh(true);
    } catch (e) {
      console.error("[useEntityList] Delete Error:", e);
      toast.error("فشل الحذف: " + e);
    }
  }, [selectedId, refresh]);

  return {
    items,
    filtered,
    loading,
    refreshing,
    saving,
    search,
    setSearch,
    refresh,
    selectedId,
    setSelectedId,
    selectedItem,
    editItem,
    isFormOpen,
    setIsFormOpen,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  };
}
