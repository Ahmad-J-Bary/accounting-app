import { useMemo } from "react";
import type { PartnerDto } from '@modules/partners/api/partnerService';

export type ProfitSharingStrategy = "BasedOnCapitalLocal" | "BasedOnCapitalOriginal" | "Manual";

interface UsePartnerRatiosProps {
  partners: PartnerDto[];
  strategy: string;
  exchangeRate?: number;
}

export function usePartnerRatios({ partners, strategy, exchangeRate }: UsePartnerRatiosProps) {
  const totals = useMemo(() => {
    const local = partners.reduce((sum, p) => {
      const amountOriginal = parseFloat(p.amount_original || "0");
      if (amountOriginal > 0) {
        return sum + (amountOriginal * exchangeRate);
      }
      return sum + parseFloat(p.amount_local || "0");
    }, 0);
    const original = partners.reduce((sum, p) => sum + parseFloat(p.amount_original || "0"), 0);
    return { local, original };
  }, [partners, exchangeRate]);

  const partnersWithRatios = useMemo(() => {
    return partners.map(p => {
      const amountLocal = (() => {
        const amountOriginal = parseFloat(p.amount_original || "0");
        if (amountOriginal > 0) {
          return amountOriginal * exchangeRate;
        }
        return parseFloat(p.amount_local || "0");
      })();

      const amountOriginal = parseFloat(p.amount_original || "0");

      const capitalRatio = totals.local > 0 ? (amountLocal / totals.local) * 100 : 0;

      let ratio = 0;
      if (strategy === "Manual") {
        ratio = parseFloat(p.profit_sharing_ratio || "0");
      } else if (strategy === "BasedOnCapitalLocal" && totals.local > 0) {
        ratio = (amountLocal / totals.local) * 100;
      } else if (strategy === "BasedOnCapitalOriginal" && totals.original > 0) {
        ratio = (amountOriginal / totals.original) * 100;
      }
      return { 
        ...p, 
        calculatedRatio: ratio, 
        calculatedCapitalRatio: capitalRatio,
        displayAmountLocal: amountLocal,
        displayAmountOriginal: amountOriginal
      };
    });
  }, [partners, totals, strategy, exchangeRate]);

  const chartCapitalData = useMemo(() => 
    partnersWithRatios.map(p => ({ name: p.name, value: p.displayAmountLocal })),
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