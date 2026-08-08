import { endOfDay } from "./date-utils";
import type { PartnerDto, AccountLedgerDto } from "@erp/shared-types";

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
  partnerLedgers?: Record<string, AccountLedgerDto>,
  toDate?: string,
): PartnerProfitShareComputed {
  const toTs = toDate ? endOfDay(toDate) : Infinity;

  const existedPartners = partnerLedgers
    ? partners.filter((p) => {
        if (!p.linked_account_id) return true;
        const ledger = partnerLedgers[p.linked_account_id];
        if (!ledger || !ledger.lines) return false;
        return ledger.lines.some((line) => {
          const lineTs = new Date(line.date).getTime();
          return Number.isFinite(lineTs) && lineTs <= toTs;
        });
      })
    : partners;

  const totalCapital = existedPartners.reduce((s, p) => s + parseFloat(p.amount_local || "0"), 0);
  const totalOriginalCapital = existedPartners.reduce((s, p) => s + parseFloat(p.amount_original || "0"), 0);
  const totalOperationalAssets = inventoryValue + fixedAssetsValue + customerDebts;

  const rows: PartnerProfitShareRow[] = existedPartners.map(p => {
    const capitalAmount = parseFloat(p.amount_local || "0");
    const capitalRatio = totalCapital > 0 ? (capitalAmount / totalCapital) * 100 : 0;
    const originalAmount = parseFloat(p.amount_original || "0");
    const originalRatio = totalOriginalCapital > 0 ? (originalAmount / totalOriginalCapital) * 100 : 0;

    // Per-partner profit-sharing type (spec Sec 23): Manual wins; otherwise the
    // ratio is capital-based — either on LOCAL (base) capital or on the
    // partner's ORIGINAL (own-currency) capital, which stays currency-independent.
    let profitShareRatio: number;
    if (p.profit_sharing_type === "Manual") {
      profitShareRatio = p.profit_sharing_ratio ? parseFloat(p.profit_sharing_ratio) : 0;
    } else if (p.profit_sharing_type === "BasedOnCapitalOriginal") {
      profitShareRatio = originalRatio;
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
