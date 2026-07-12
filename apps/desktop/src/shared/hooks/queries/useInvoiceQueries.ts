import { useQuery } from "@tanstack/react-query";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { InvoiceDto } from "@erp/shared-types";

export function useSalesInvoices() {
  return useQuery<InvoiceDto[]>({
    queryKey: QUERY_KEYS.salesInvoices,
    queryFn: () => invoiceService.listInvoicesByType("Sales"),
  });
}

export function usePurchaseInvoices() {
  return useQuery<InvoiceDto[]>({
    queryKey: QUERY_KEYS.purchaseInvoices,
    queryFn: () => invoiceService.listInvoicesByType("Purchase"),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery<InvoiceDto | undefined>({
    queryKey: QUERY_KEYS.invoice(id ?? ""),
    queryFn: async () => {
      const sales = await invoiceService.listInvoicesByType("Sales");
      const found = sales.find((i) => i.id === id);
      if (found) return found;
      const purchase = await invoiceService.listInvoicesByType("Purchase");
      return purchase.find((i) => i.id === id);
    },
    enabled: !!id,
  });
}
