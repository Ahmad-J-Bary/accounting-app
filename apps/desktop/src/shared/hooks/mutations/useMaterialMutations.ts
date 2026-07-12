import { useMutation, useQueryClient } from "@tanstack/react-query";
import { materialService } from "@modules/inventory/api/materialService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { toast } from "sonner";

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof materialService.createMaterial>[0]) =>
      materialService.createMaterial(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      toast.success("تم إضافة المادة بنجاح");
    },
    onError: (e: Error) => toast.error("فشل إضافة المادة: " + e.message),
  });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof materialService.updateMaterial>[0]) =>
      materialService.updateMaterial(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      toast.success("تم تحديث المادة بنجاح");
    },
    onError: (e: Error) => toast.error("فشل تحديث المادة: " + e.message),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => materialService.deleteMaterial(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      toast.success("تم حذف المادة بنجاح");
    },
    onError: (e: Error) => toast.error("فشل حذف المادة: " + e.message),
  });
}
