import { useQuery } from "@tanstack/react-query";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { partnerService } from "@modules/partners/api/partnerService";
import type { CustomerDto, SupplierDto, PartnerDto } from "@erp/shared-types";
import { QUERY_KEYS } from "@shared/hooks/queryClient";

/**
 * Targeted fetches for the entity linked to a COA account. Only the matching
 * entity is fetched (get by id), never the whole list — partners are few, so a
 * lightweight list query + match by account role is used for them.
 */

export function useLinkedCustomer(id: string | null | undefined) {
  return useQuery<CustomerDto | null>({
    queryKey: QUERY_KEYS.customer(id ?? ""),
    queryFn: () => customerService.get(id!),
    enabled: !!id,
  });
}

export function useLinkedSupplier(id: string | null | undefined) {
  return useQuery<SupplierDto | null>({
    queryKey: QUERY_KEYS.supplier(id ?? ""),
    queryFn: () => supplierService.get(id!),
    enabled: !!id,
  });
}

export type PartnerAccountRole = "capital" | "drawings" | "current";

export function useLinkedPartner(
  accountId: string | null | undefined,
  role: PartnerAccountRole | null | undefined,
) {
  return useQuery<PartnerDto[], Error, PartnerDto | null>({
    queryKey: QUERY_KEYS.partners,
    queryFn: () => partnerService.listPartners(),
    staleTime: 60_000,
    select: (partners) => {
      if (!accountId || !role) return null;
      return (
        partners.find((p) =>
          role === "capital"
            ? p.linked_account_id === accountId
            : role === "drawings"
              ? p.drawings_account_id === accountId
              : p.current_account_id === accountId,
        ) ?? null
      );
    },
    enabled: !!accountId && !!role,
  });
}