import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useDataTable } from "./useDataTable";

interface UseMasterDataOptions<T, P> {
  fetchData: () => Promise<T[]>;
  saveData: (payload: P) => Promise<any>;
  deleteData: (id: string) => Promise<void>;
  searchFields: (keyof T)[];
  errorLabel: string;
  successLabel: string;
}

/**
 * A higher-level hook that extends useDataTable with common CRUD states (Selected, Edit, Dialog, Save/Delete logic).
 */
export function useMasterData<T extends { id: string; name: string }, P>({
  fetchData,
  saveData,
  deleteData,
  searchFields,
  errorLabel,
  successLabel,
}: UseMasterDataOptions<T, P>) {
  const table = useDataTable<T>({
    fetchData,
    searchFields,
    errorLabel,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<T | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleOpenAdd = useCallback(() => {
    setEditItem(null);
    setIsFormOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: T) => {
    setEditItem(item);
    setIsFormOpen(true);
  }, []);

  const handleSave = async (payload: P) => {
    try {
      setSaving(true);
      await saveData(payload);
      toast.success(successLabel);
      setIsFormOpen(false);
      table.refresh(true);
    } catch (e) {
      toast.error("خطأ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف ${name}؟`)) return;
    try {
      await deleteData(id);
      toast.success("تم الحذف بنجاح");
      table.setData(prev => prev.filter(item => item.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      toast.error("فشل الحذف: " + e);
    }
  };

  return {
    ...table,
    selectedId,
    setSelectedId,
    editItem,
    setEditItem,
    isFormOpen,
    setIsFormOpen,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  };
}
