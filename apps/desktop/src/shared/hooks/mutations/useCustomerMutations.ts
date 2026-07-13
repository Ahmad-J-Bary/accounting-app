import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@modules/partners/api/customerService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { toast } from "sonner";
import type { CreateCustomerRequest, UpdateCustomerRequest } from "@erp/shared-types";

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateCustomerRequest) => customerService.create(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.customers });
      toast.success("تم إضافة العميل بنجاح");
    },
    onError: (e: Error) => toast.error("فشل إضافة العميل: " + e.message),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: UpdateCustomerRequest) => customerService.update(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.customers });
      toast.success("تم تحديث العميل بنجاح");
    },
    onError: (e: Error) => toast.error("فشل تحديث العميل: " + e.message),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.customers });
      toast.success("تم حذف العميل بنجاح");
    },
    onError: (e: Error) => toast.error("فشل حذف العميل: " + e.message),
  });
}
