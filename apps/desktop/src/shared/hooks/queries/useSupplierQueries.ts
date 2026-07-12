import { useQuery } from "@tanstack/react-query";
import { supplierService } from "@modules/partners/api/supplierService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { paymentService } from "@modules/payments/api/paymentService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { SupplierDto } from "@erp/shared-types";

export function useSuppliers() {
  return useQuery<SupplierDto[]>({
    queryKey: QUERY_KEYS.suppliers,
    queryFn: () => supplierService.listSuppliers(),
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery<SupplierDto | undefined>({
    queryKey: QUERY_KEYS.supplier(id ?? ""),
    queryFn: async () => {
      const suppliers = await supplierService.listSuppliers();
      return suppliers.find((s) => s.id === id);
    },
    enabled: !!id,
  });
}

export function useSupplierInvoices(supplierId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.supplierInvoices(supplierId ?? ""),
    queryFn: async () => {
      const all = await invoiceService.listInvoicesByType("Purchase");
      return all.filter((inv) => inv.supplier_id === supplierId);
    },
    enabled: !!supplierId,
  });
}

export function useSupplierPayments(supplierId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.supplierPayments(supplierId ?? ""),
    queryFn: () => paymentService.listPayments(supplierId!),
    enabled: !!supplierId,
  });
}
