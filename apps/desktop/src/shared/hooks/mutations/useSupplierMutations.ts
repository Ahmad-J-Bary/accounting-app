import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supplierService } from "@modules/partners/api/supplierService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { toast } from "sonner";
import type { CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateSupplierRequest) => supplierService.create(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.suppliers });
      toast.success("تم إضافة المورد بنجاح");
    },
    onError: (e: Error) => toast.error("فشل إضافة المورد: " + e.message),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: UpdateSupplierRequest) => supplierService.update(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.suppliers });
      toast.success("تم تحديث المورد بنجاح");
    },
    onError: (e: Error) => toast.error("فشل تحديث المورد: " + e.message),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supplierService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.suppliers });
      toast.success("تم حذف المورد بنجاح");
    },
    onError: (e: Error) => toast.error("فشل حذف المورد: " + e.message),
  });
}
