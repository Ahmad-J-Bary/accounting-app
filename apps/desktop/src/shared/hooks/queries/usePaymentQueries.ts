import { useQuery } from "@tanstack/react-query";
import { paymentService } from "@modules/payments/api/paymentService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { Payment } from "@erp/shared-types";

export function usePayments() {
  return useQuery<Payment[]>({
    queryKey: QUERY_KEYS.payments,
    queryFn: () => paymentService.listPayments(),
  });
}
