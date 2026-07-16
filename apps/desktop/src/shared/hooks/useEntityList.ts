import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseEntityListProps<T, Req> {
  queryKey: string[];
  fetchData: () => Promise<T[]>;
  saveData: (payload: Req) => Promise<T>;
  deleteData: (id: string) => Promise<void>;
  searchFields: (keyof T)[];
  searchPredicate?: (item: T, search: string) => boolean;
  errorLabel?: string;
  successLabel?: string;
  manageFormState?: boolean;
}

export function useEntityList<T extends { id: string }, Req>({
  queryKey,
  fetchData,
  saveData,
  deleteData,
  searchFields,
  searchPredicate,
  successLabel = "تم الحفظ بنجاح",
  manageFormState = true,
}: UseEntityListProps<T, Req>) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<T | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const {
    data: items = [],
    isLoading: loading,
    isRefetching: refreshing,
    refetch,
  } = useQuery<T[]>({
    queryKey,
    queryFn: fetchData,
  });

  const refresh = useCallback(
    async (_silent = false) => {
      await refetch();
    },
    [refetch]
  );

  const createMutation = useMutation({ mutationFn: saveData });
  const deleteMutation = useMutation({ mutationFn: deleteData });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return items;
    if (searchPredicate) {
      return items.filter((item) => searchPredicate(item, s));
    }
    return items.filter((item) =>
      searchFields.some((field) => {
        const val = item[field];
        return val && String(val).toLowerCase().includes(s);
      })
    );
  }, [items, search, searchFields, searchPredicate]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) || null,
    [items, selectedId]
  );

  const handleOpenAdd = useCallback(() => {
    setEditItem(null);
    setSelectedId(null);
    if (manageFormState) {
      setIsFormOpen(true);
    }
  }, [manageFormState]);

  const handleOpenEdit = useCallback((item: T) => {
    setEditItem(item);
    if (manageFormState) {
      setIsFormOpen(true);
    }
  }, [manageFormState]);

  const handleSave = useCallback(
    async (payload: Req) => {
      await createMutation.mutateAsync(payload, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey });
          toast.success(successLabel);
          if (manageFormState) {
            setIsFormOpen(false);
          }
        },
        onError: (e: Error) => {
          toast.error("فشل الحفظ: " + e.message);
        },
      });
    },
    [createMutation, qc, queryKey, successLabel, manageFormState]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("هل أنت متأكد من الحذف؟")) return;
      await deleteMutation.mutateAsync(id, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey });
          toast.success("تم الحذف بنجاح");
          setSelectedId(null);
        },
        onError: (e: Error) => {
          toast.error("فشل الحذف: " + e.message);
        },
      });
    },
    [deleteMutation, qc, queryKey]
  );

  return {
    items,
    filtered,
    loading,
    refreshing,
    saving: createMutation.isPending,
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
