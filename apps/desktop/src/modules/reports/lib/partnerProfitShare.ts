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

/**
 * Resolve the effective profit-sharing ratio for a partner.
 *
 * Business rule (spec Sec 23): Manual wins; otherwise the ratio is
 * capital-based — either on LOCAL (base) capital or on the partner's
 * ORIGINAL (own-currency) capital.
 *
 * @param localRatio    - Partner's capital ratio in base currency.
 * @param originalRatio - Partner's capital ratio in own currency.
 * @param partner       - The partner record.
 * @returns The resolved profit-sharing ratio as a percentage.
 */
export function resolveProfitShareRatio(
  localRatio: number,
  originalRatio: number,
  partner: { profit_sharing_type?: string; profit_sharing_ratio?: string | null }
): number {
  if (partner.profit_sharing_type === "Manual") {
    return partner.profit_sharing_ratio ? parseFloat(partner.profit_sharing_ratio) : 0;
  }
  if (partner.profit_sharing_type === "BasedOnCapitalOriginal") {
    return originalRatio;
  }
  return localRatio;
}

/**
 * Filter partners to those with ledger evidence before a given date.
 *
 * A partner is kept if:
 * - They have no linked account (new partner without ledger yet)
 * - Their ledger is absent (transient fetch failure)
 * - They have journal lines or opening entries before the cutoff
 * - They have no dated evidence at all (capital is a static opening balance)
 */
export function filterPartnersWithLedgerEntries(
  partners: PartnerDto[],
  partnerLedgers: Record<string, AccountLedgerDto>,
  toDate?: string
): PartnerDto[] {
  if (!toDate) return partners;
  const toTs = endOfDay(toDate);

  return partners.filter((p) => {
    if (!p.linked_account_id) return true;
    const ledger = partnerLedgers[p.linked_account_id];
    if (!ledger) return true;
    const lines = ledger.lines ?? [];
    const lineBeforeTo = lines.some((line) => {
      const lineTs = new Date(line.date).getTime();
      return Number.isFinite(lineTs) && lineTs <= toTs;
    });
    if (lineBeforeTo) return true;
    const openings = (ledger.opening_entries ?? []).length
      ? (ledger.opening_entries ?? [])
      : ledger.opening_entry
        ? [ledger.opening_entry]
        : [];
    const openingBeforeTo = openings.some((entry) => {
      const entryTs = new Date(entry.date).getTime();
      return Number.isFinite(entryTs) && entryTs <= toTs;
    });
    if (openingBeforeTo) return true;
    return lines.length === 0 && openings.length === 0;
  });
}

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
  const existedPartners = partnerLedgers
    ? filterPartnersWithLedgerEntries(partners, partnerLedgers, toDate)
    : partners;

  const totalCapital = existedPartners.reduce((s, p) => s + parseFloat(p.amount_local || "0"), 0);
  const totalOriginalCapital = existedPartners.reduce((s, p) => s + parseFloat(p.amount_original || "0"), 0);
  const totalOperationalAssets = inventoryValue + fixedAssetsValue + customerDebts;

  const rows: PartnerProfitShareRow[] = existedPartners.map(p => {
    const capitalAmount = parseFloat(p.amount_local || "0");
    const capitalRatio = totalCapital > 0 ? (capitalAmount / totalCapital) * 100 : 0;
    const originalAmount = parseFloat(p.amount_original || "0");
    const originalRatio = totalOriginalCapital > 0 ? (originalAmount / totalOriginalCapital) * 100 : 0;

    const profitShareRatio = resolveProfitShareRatio(capitalRatio, originalRatio, p);

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
