import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentService } from "@modules/payments/api/paymentService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { toast } from "sonner";
import type { CreatePaymentRequest } from "@erp/shared-types";

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreatePaymentRequest) => paymentService.createPayment(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.payments });
      toast.success("تم تسجيل السند بنجاح");
    },
    onError: (e: Error) => toast.error("فشل تسجيل السند: " + e.message),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentService.deletePayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.payments });
      toast.success("تم حذف السند بنجاح");
    },
    onError: (e: Error) => toast.error("فشل حذف السند: " + e.message),
  });
}
