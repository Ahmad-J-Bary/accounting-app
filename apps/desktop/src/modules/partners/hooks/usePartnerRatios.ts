import { useMemo } from "react";
import { resolveProfitShareRatio } from "@shared/lib/partner-utils";
import type { PartnerDto } from '@modules/partners/api/partnerService';


export type ProfitSharingStrategy = "auto" | "BasedOnCapitalLocal" | "BasedOnCapitalOriginal" | "Manual";

export type PartnerWithRatios = PartnerDto & {
  calculatedRatio: number;
  calculatedCapitalRatio: number;
  calculatedOriginalRatio: number;
  displayAmountBase: number;
};

interface UsePartnerRatiosProps {
  partners: PartnerDto[];
  strategy: string;
}

/**
 * Computes per-partner capital amounts and ratios.
 *
 * - `auto`: each partner's own `profit_sharing_type` decides the ratio.
 * - `BasedOnCapitalLocal`: ratios derive from LOCAL (base-currency) capital, so
 *   partners in different currencies are converted to base first.
 * - `BasedOnCapitalOriginal`: ratios derive from each partner's ORIGINAL
 *   (own-currency) amount — a currency-independent share even when partners mix
 *   currencies (spec Sec 23).
 * - `Manual`: an explicitly-set per-partner profit ratio wins.
 */
export function usePartnerRatios({ partners, strategy }: UsePartnerRatiosProps) {
  // Base-currency totals come straight from the registered `amount_local`
  // (the exact figure the backend equity statement uses), never from a
  // current-market-rate conversion of `amount_original`.
  const totalLocal = useMemo(() => {
    return partners.reduce((sum, p) => sum + parseFloat(p.amount_local || "0"), 0);
  }, [partners]);

  // Own-currency total for the original-capital strategy (sum of original amounts).
  const totalOriginal = useMemo(() => {
    return partners.reduce((sum, p) => sum + parseFloat(p.amount_original || "0"), 0);
  }, [partners]);

  const partnersWithRatios: PartnerWithRatios[] = useMemo(() => {
    const ratioOfLocal = (localAmount: number) => (totalLocal > 0 ? (localAmount / totalLocal) * 100 : 0);
    const ratioOfOriginal = (original: number) => (totalOriginal > 0 ? (original / totalOriginal) * 100 : 0);

    return partners.map(p => {
      const amountOriginal = parseFloat(p.amount_original || "0");
      const localAmount = parseFloat(p.amount_local || "0");
      const ownType: ProfitSharingStrategy =
        p.profit_sharing_type === "Manual" || p.profit_sharing_type === "BasedOnCapitalOriginal"
          ? p.profit_sharing_type
          : "BasedOnCapitalLocal";
      const eff: ProfitSharingStrategy =
        strategy === "auto" ? ownType : (strategy as ProfitSharingStrategy);

      const localRatio = ratioOfLocal(localAmount);
      const originalRatio = ratioOfOriginal(amountOriginal);

      // When strategy is overridden, force the effective type to match
      const effPartner = eff === "auto" ? p : { ...p, profit_sharing_type: eff };
      const ratio = resolveProfitShareRatio(localRatio, originalRatio, effPartner);

      return {
        ...p,
        calculatedRatio: ratio,
        calculatedCapitalRatio: localRatio,
        calculatedOriginalRatio: originalRatio,
        displayAmountBase: localAmount
      };
    });
  }, [partners, totalLocal, totalOriginal, strategy]);

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
    totalLocal,
    partnersWithRatios,
    chartCapitalData,
    chartProfitData
  };
}
