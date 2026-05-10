import { useMemo } from "react";
import type { PartnerDto } from '@modules/partners/api/partnerService';

export type ProfitSharingStrategy = "BasedOnCapitalLocal" | "BasedOnCapitalUSD" | "Manual";

interface UsePartnerRatiosProps {
  partners: PartnerDto[];
  strategy: string;
  exchangeRate?: number;
}

export function usePartnerRatios({ partners, strategy, exchangeRate = 100 }: UsePartnerRatiosProps) {
  const totals = useMemo(() => {
    const local = partners.reduce((sum, p) => {
      const amountUsd = parseFloat(p.amount_usd || "0");
      if (amountUsd > 0) {
        return sum + (amountUsd * exchangeRate);
      }
      return sum + parseFloat(p.amount_local || "0");
    }, 0);
    const usd = partners.reduce((sum, p) => sum + parseFloat(p.amount_usd || "0"), 0);
    return { local, usd };
  }, [partners, exchangeRate]);

  const partnersWithRatios = useMemo(() => {
    return partners.map(p => {
      const amountLocal = (() => {
        const amountUsd = parseFloat(p.amount_usd || "0");
        if (amountUsd > 0) {
          return amountUsd * exchangeRate;
        }
        return parseFloat(p.amount_local || "0");
      })();

      const amountUsd = parseFloat(p.amount_usd || "0");

      const capitalRatio = totals.local > 0 ? (amountLocal / totals.local) * 100 : 0;

      let ratio = 0;
      if (strategy === "Manual") {
        ratio = parseFloat(p.profit_sharing_ratio || "0");
      } else if (strategy === "BasedOnCapitalLocal" && totals.local > 0) {
        ratio = (amountLocal / totals.local) * 100;
      } else if (strategy === "BasedOnCapitalUSD" && totals.usd > 0) {
        ratio = (amountUsd / totals.usd) * 100;
      }
      return { 
        ...p, 
        calculatedRatio: ratio, 
        calculatedCapitalRatio: capitalRatio,
        displayAmountLocal: amountLocal,
        displayAmountUsd: amountUsd
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