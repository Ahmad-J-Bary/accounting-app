import { useQuery } from "@tanstack/react-query";
import { partnerService } from "@modules/partners/api/partnerService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { PartnerDto } from "@erp/shared-types";

export function usePartners() {
  return useQuery<PartnerDto[]>({
    queryKey: QUERY_KEYS.partners,
    queryFn: () => partnerService.listPartners(),
  });
}

export function usePartner(id: string | undefined) {
  return useQuery<PartnerDto | undefined>({
    queryKey: QUERY_KEYS.partner(id ?? ""),
    queryFn: async () => {
      const partners = await partnerService.listPartners();
      return partners.find((p) => p.id === id);
    },
    enabled: !!id,
  });
}
