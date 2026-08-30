import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { partnerService } from "@modules/partners/api/partnerService";
import { usePartnerRatios } from "@modules/partners/hooks/usePartnerRatios";
import { QUERY_KEYS } from "@shared/hooks/queryClient";

/**
 * Resolves the profit-share ratio (%) of ONE partner exactly the way the
 * partners page does — same `QUERY_KEYS.partners` list (so the COA view shares
 * the partners page cache, never refetches) and same `usePartnerRatios`
 * resolver. Honors the strategy the user picked on the partners page via the
 * persisted `partnerProfitStrategy` localStorage key.
 *
 * Returns `null` while loading / when unused (no partner selected).
 */
export function usePartnerProfitRatio(partnerId: string | null | undefined) {
  const { data: partners = [] } = useQuery({
    queryKey: QUERY_KEYS.partners,
    queryFn: () => partnerService.listPartners(),
    enabled: !!partnerId,
  });

  const strategy = useMemo(() => {
    try {
      return localStorage.getItem("partnerProfitStrategy") || "auto";
    } catch {
      return "auto";
    }
  }, []);

  const { partnersWithRatios } = usePartnerRatios({ partners, strategy });

  return useMemo(() => {
    if (!partnerId) return null;
    const selected = partnersWithRatios.find((p) => p.id === partnerId);
    return selected ? selected.calculatedRatio : null;
  }, [partnersWithRatios, partnerId]);
}