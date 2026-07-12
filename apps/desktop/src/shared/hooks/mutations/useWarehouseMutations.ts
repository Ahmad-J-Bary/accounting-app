import { useMutation, useQueryClient } from "@tanstack/react-query";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { toast } from "sonner";

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof warehouseService.createWarehouse>[0]) =>
      warehouseService.createWarehouse(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.warehouses });
      toast.success("تم إضافة المستودع بنجاح");
    },
    onError: (e: Error) => toast.error("فشل إضافة المستودع: " + e.message),
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof warehouseService.updateWarehouse>[0]) =>
      warehouseService.updateWarehouse(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.warehouses });
      toast.success("تم تحديث المستودع بنجاح");
    },
    onError: (e: Error) => toast.error("فشل تحديث المستودع: " + e.message),
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseService.deleteWarehouse(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.warehouses });
      toast.success("تم حذف المستودع بنجاح");
    },
    onError: (e: Error) => toast.error("فشل حذف المستودع: " + e.message),
  });
}
