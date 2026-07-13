import { useMemo } from "react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { PartnerDto } from '@modules/partners/api/partnerService';


export type ProfitSharingStrategy = "BasedOnCapital" | "Manual";

interface UsePartnerRatiosProps {
  partners: PartnerDto[];
  strategy: string;
}

/**
 * Computes per-partner capital amounts and ratios using base currency conversion
 * to ensure partners with different currencies are compared correctly!
 */
export function usePartnerRatios({ partners, strategy }: UsePartnerRatiosProps) {
  const { toBase } = useCurrencyContext();
  
  // Calculate all totals in base currency for consistency
  const totals = useMemo(() => {
    const base = partners.reduce((sum, p) => {
      const amt = parseFloat(p.amount_original || "0");
      return sum + toBase(amt, p.currency);
    }, 0);
    
    return { base };
  }, [partners, toBase]);

  const partnersWithRatios = useMemo(() => {
    return partners.map(p => {
      const amountOriginal = parseFloat(p.amount_original || "0");
      const baseAmount = toBase(amountOriginal, p.currency);

      let capitalRatio = 0;
      let ratio = 0;

      if (strategy === "Manual") {
        // Capital ratio still based on base currency
        if (totals.base > 0) {
          capitalRatio = (baseAmount / totals.base) * 100;
        }
        ratio = parseFloat(p.profit_sharing_ratio || "0");
      } else {
        // Both BasedOnCapitalOriginal and BasedOnCapitalLocal now use base currency ratios
        if (totals.base > 0) {
          capitalRatio = (baseAmount / totals.base) * 100;
          ratio = capitalRatio;
        }
      }

      return { 
        ...p, 
        calculatedRatio: ratio, 
        calculatedCapitalRatio: capitalRatio,
        displayAmountBase: baseAmount
      };
    });
  }, [partners, totals, strategy, toBase]);

  const chartCapitalData = useMemo(() => 
    partnersWithRatios.map(p => ({
      name: p.name,
      value: p.displayAmountBase,
    })),
    [partnersWithRatios]
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
