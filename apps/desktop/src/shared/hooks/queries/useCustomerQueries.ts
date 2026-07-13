import { useQuery } from "@tanstack/react-query";
import { customerService } from "@modules/partners/api/customerService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { paymentService } from "@modules/payments/api/paymentService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { CustomerDto } from "@erp/shared-types";

export function useCustomers() {
  return useQuery<CustomerDto[]>({
    queryKey: QUERY_KEYS.customers,
    queryFn: () => customerService.list(),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery<CustomerDto | undefined>({
    queryKey: QUERY_KEYS.customer(id ?? ""),
    queryFn: async () => {
      const customers = await customerService.list();
      return customers.find((c) => c.id === id);
    },
    enabled: !!id,
  });
}

export function useCustomerInvoices(customerId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.customerInvoices(customerId ?? ""),
    queryFn: async () => {
      const all = await invoiceService.listInvoicesByType("Sales");
      return all.filter((inv) => inv.customer_id === customerId);
    },
    enabled: !!customerId,
  });
}

export function useCustomerPayments(customerId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.customerPayments(customerId ?? ""),
    queryFn: () => paymentService.listPayments(customerId!),
    enabled: !!customerId,
  });
}
