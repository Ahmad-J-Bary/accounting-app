export { resolveProfitShareRatio } from "@shared/lib/partner-utils";

export type PartnerProfitShareRow = {
  partnerId: string;
  partnerName: string;
  capitalRatio: number;
  capitalAmount: number;
  profitShareRatio: number;
  profitShareAmount: number;
  currentYearProfitShare: number;
  totalProfitAllocated: number;
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
