import { useMutation, useQueryClient } from "@tanstack/react-query";
import { categoryService } from "@modules/inventory/api/categoryService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { toast } from "sonner";

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof categoryService.createCategory>[0]) =>
      categoryService.createCategory(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.categories });
      toast.success("تم إضافة التصنيف بنجاح");
    },
    onError: (e: Error) => toast.error("فشل إضافة التصنيف: " + e.message),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof categoryService.updateCategory>[0]) =>
      categoryService.updateCategory(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.categories });
      toast.success("تم تحديث التصنيف بنجاح");
    },
    onError: (e: Error) => toast.error("فشل تحديث التصنيف: " + e.message),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoryService.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.categories });
      toast.success("تم حذف التصنيف بنجاح");
    },
    onError: (e: Error) => toast.error("فشل حذف التصنيف: " + e.message),
  });
}
