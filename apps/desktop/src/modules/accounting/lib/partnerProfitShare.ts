import type { PartnerDto } from "@erp/shared-types";

export type PartnerProfitShareFilters = {
  from_date: string;
  to_date: string;
};

export type PartnerProfitShareRow = {
  partnerId: string;
  partnerName: string;
  capitalRatio: number;
  capitalAmount: number;
  profitShareRatio: number;
  profitShareAmount: number;
  drawings: number;
  finalAmount: number;
  inventoryShare: number;
};

export type PartnerProfitShareComputed = {
  totalCapital: number;
  netProfit: number;
  inventoryValue: number;
  totalCustomerDebts: number;
  rows: PartnerProfitShareRow[];
};

export function computePartnerProfitShare(
  partners: PartnerDto[],
  netProfit: number,
  inventoryValue: number,
  partnerDrawings: Record<string, number>,
  customerDebts: number,
): PartnerProfitShareComputed {
  const totalCapital = partners.reduce((s, p) => s + parseFloat(p.amount_local || "0"), 0);

  const rows: PartnerProfitShareRow[] = partners.map(p => {
    const capitalAmount = parseFloat(p.amount_local || "0");
    const capitalRatio = totalCapital > 0 ? (capitalAmount / totalCapital) * 100 : 0;

    let profitShareRatio: number;
    if (p.profit_sharing_type === "Manual") {
      profitShareRatio = p.profit_sharing_ratio ? parseFloat(p.profit_sharing_ratio) : 0;
    } else {
      profitShareRatio = capitalRatio;
    }

    const profitShareAmount = netProfit * (profitShareRatio / 100);
    const drawings = partnerDrawings[p.id] || 0;
    const finalAmount = capitalAmount + profitShareAmount - drawings;
    const inventoryShare = inventoryValue * (profitShareRatio / 100);

    return {
      partnerId: p.id,
      partnerName: p.name,
      capitalRatio,
      capitalAmount,
      profitShareRatio,
      profitShareAmount,
      drawings,
      finalAmount,
      inventoryShare,
    };
  });

  return {
    totalCapital,
    netProfit,
    inventoryValue,
    totalCustomerDebts: customerDebts,
    rows,
  };
}
