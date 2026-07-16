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
  fixedAssetsShare: number;
  operationalAssetShare: number;
};

export type PartnerProfitShareComputed = {
  totalCapital: number;
  netProfit: number;
  inventoryValue: number;
  fixedAssetsValue: number;
  totalOperationalAssets: number;
  totalCustomerDebts: number;
  rows: PartnerProfitShareRow[];
};

export function computePartnerProfitShare(
  partners: PartnerDto[],
  netProfit: number,
  inventoryValue: number,
  fixedAssetsValue: number,
  partnerDrawings: Record<string, number>,
  customerDebts: number,
): PartnerProfitShareComputed {
  const totalCapital = partners.reduce((s, p) => s + parseFloat(p.amount_local || "0"), 0);
  const totalOperationalAssets = inventoryValue + fixedAssetsValue + customerDebts;

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
    const fixedAssetsShare = fixedAssetsValue * (profitShareRatio / 100);
    const operationalAssetShare = totalOperationalAssets * (profitShareRatio / 100);

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
      fixedAssetsShare,
      operationalAssetShare,
    };
  });

  return {
    totalCapital,
    netProfit,
    inventoryValue,
    fixedAssetsValue,
    totalOperationalAssets,
    totalCustomerDebts: customerDebts,
    rows,
  };
}
