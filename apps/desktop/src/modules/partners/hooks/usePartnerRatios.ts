import { useMemo } from "react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { PartnerDto } from '@modules/partners/api/partnerService';


export type ProfitSharingStrategy = "auto" | "BasedOnCapitalLocal" | "BasedOnCapitalOriginal" | "Manual";

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
  const { toBase } = useCurrencyContext();

  // Base-currency total for the local-capital strategy.
  const totals = useMemo(() => {
    const base = partners.reduce((sum, p) => {
      const amt = parseFloat(p.amount_original || "0");
      return sum + toBase(amt, p.currency);
    }, 0);

    return { base };
  }, [partners, toBase]);

  // Own-currency total for the original-capital strategy (sum of original amounts).
  const totalOriginal = useMemo(() => {
    return partners.reduce((sum, p) => sum + parseFloat(p.amount_original || "0"), 0);
  }, [partners]);

  const partnersWithRatios = useMemo(() => {
    const ratioOfLocal = (baseAmount: number) => (totals.base > 0 ? (baseAmount / totals.base) * 100 : 0);
    const ratioOfOriginal = (original: number) => (totalOriginal > 0 ? (original / totalOriginal) * 100 : 0);

    return partners.map(p => {
      const amountOriginal = parseFloat(p.amount_original || "0");
      const baseAmount = toBase(amountOriginal, p.currency);
      const ownType: ProfitSharingStrategy =
        p.profit_sharing_type === "Manual" || p.profit_sharing_type === "BasedOnCapitalOriginal"
          ? p.profit_sharing_type
          : "BasedOnCapitalLocal";
      const eff: ProfitSharingStrategy =
        strategy === "auto" ? ownType : (strategy as ProfitSharingStrategy);

      let capitalRatio = 0;
      let ratio = 0;

      if (eff === "Manual") {
        capitalRatio = ratioOfLocal(baseAmount);
        ratio = parseFloat(p.profit_sharing_ratio || "0");
      } else if (eff === "BasedOnCapitalOriginal") {
        // Original amounts are in each partner's own currency; the percentage
        // is computed on the raw (unconverted) totals.
        capitalRatio = ratioOfOriginal(amountOriginal);
        ratio = capitalRatio;
      } else {
        // BasedOnCapitalLocal: compare local (base-currency) capital.
        capitalRatio = ratioOfLocal(baseAmount);
        ratio = capitalRatio;
      }

      return {
        ...p,
        calculatedRatio: ratio,
        calculatedCapitalRatio: capitalRatio,
        displayAmountBase: baseAmount
      };
    });
  }, [partners, totals, totalOriginal, strategy, toBase]);

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
