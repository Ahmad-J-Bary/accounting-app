import { useMemo } from "react";
import type { PartnerDto } from '@modules/partners/api/partnerService';


export type ProfitSharingStrategy = "BasedOnCapitalLocal" | "BasedOnCapitalOriginal" | "Manual";

interface UsePartnerRatiosProps {
  partners: PartnerDto[];
  strategy: string;
}

/**
 * Computes per-partner capital amounts and ratios using the amounts the
 * backend already stored (amount_local / amount_original), not by
 * re-computing from exchange_rate.  Capital ratio follows the same strategy
 * as profit ratio so both "محلي" and "أصلي" views show correct proportions.
 */
export function usePartnerRatios({ partners, strategy }: UsePartnerRatiosProps) {
  const totals = useMemo(() => {
    const local = partners.reduce((sum, p) => sum + parseFloat(p.amount_local || "0"), 0);
    const original = partners.reduce((sum, p) => sum + parseFloat(p.amount_original || "0"), 0);
    return { local, original };
  }, [partners]);

  const partnersWithRatios = useMemo(() => {
    return partners.map(p => {
      const amountLocal = parseFloat(p.amount_local || "0");
      const amountOriginal = parseFloat(p.amount_original || "0");

      let capitalRatio = 0;
      let ratio = 0;

      if (strategy === "Manual") {
        if (totals.local > 0) {
          capitalRatio = (amountLocal / totals.local) * 100;
        }
        ratio = parseFloat(p.profit_sharing_ratio || "0");
      } else if (strategy === "BasedOnCapitalOriginal") {
        if (totals.original > 0) {
          capitalRatio = (amountOriginal / totals.original) * 100;
          ratio = capitalRatio;
        }
      } else {
        // BasedOnCapitalLocal (default)
        if (totals.local > 0) {
          capitalRatio = (amountLocal / totals.local) * 100;
          ratio = capitalRatio;
        }
      }

      return { 
        ...p, 
        calculatedRatio: ratio, 
        calculatedCapitalRatio: capitalRatio,
        displayAmountLocal: amountLocal,
        displayAmountOriginal: amountOriginal
      };
    });
  }, [partners, totals, strategy]);

  const chartCapitalData = useMemo(() => 
    partnersWithRatios.map(p => ({
      name: p.name,
      value: strategy === "BasedOnCapitalOriginal" ? p.displayAmountOriginal : p.displayAmountLocal,
    })),
    [partnersWithRatios, strategy]
  );

  const chartProfitData = useMemo(() => 
    partnersWithRatios.map(p => ({ name: p.name, value: p.calculatedRatio })),
    [partnersWithRatios]
  );

  return {
    totals,
    partnersWithRatios,
    chartCapitalData,
    chartProfitData
  };
}
