import { useMemo } from "react";
import type { PartnerDto } from "@/services/partnerService";

export type ProfitSharingStrategy = "BasedOnCapitalLocal" | "BasedOnCapitalUSD" | "Manual";

interface UsePartnerRatiosProps {
  partners: PartnerDto[];
  strategy: string;
}

export function usePartnerRatios({ partners, strategy }: UsePartnerRatiosProps) {
  const totals = useMemo(() => {
    const local = partners.reduce((sum, p) => sum + parseFloat(p.amount_local || "0"), 0);
    const usd = partners.reduce((sum, p) => sum + parseFloat(p.amount_usd || "0"), 0);
    return { local, usd };
  }, [partners]);

  const partnersWithRatios = useMemo(() => {
    return partners.map(p => {
      let ratio = 0;
      if (strategy === "Manual") {
        ratio = parseFloat(p.profit_sharing_ratio || "0");
      } else if (strategy === "BasedOnCapitalLocal" && totals.local > 0) {
        ratio = (parseFloat(p.amount_local || "0") / totals.local) * 100;
      } else if (strategy === "BasedOnCapitalUSD" && totals.usd > 0) {
        ratio = (parseFloat(p.amount_usd || "0") / totals.usd) * 100;
      }
      return { ...p, calculatedRatio: ratio };
    });
  }, [partners, totals, strategy]);

  const chartCapitalData = useMemo(() => 
    partners.map(p => ({ name: p.name, value: parseFloat(p.amount_local || "0") })),
    [partners]
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
