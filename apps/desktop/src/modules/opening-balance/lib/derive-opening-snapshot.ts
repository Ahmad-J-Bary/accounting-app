// Derive the opening dashboard snapshot from the persisted opening
// position-control data. Pure and data-driven (no live wizard state): every
// section amount comes from the migration's account-bucketed detail lines, so
// the overview tab reads the same truth the backend reports.

import type { OpeningPositionControlDto, PositionAccountLine } from "@erp/shared-types";
import type { OpeningMigrationStatus } from "../../accounting/api/openingBalanceService";
import type { TranslateFn } from "./migration-labels";

export interface OpeningSectionLine {
  code: string;
  name_ar: string;
  amount: number;
}

export interface OpeningSection {
  key: string;
  label: string;
  amount: number;
  done: boolean;
  lines: OpeningSectionLine[];
}

export interface OpeningSnapshot {
  status: OpeningMigrationStatus | null;
  cutoverDate: string;
  sections: OpeningSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
  residualApplied: boolean;
  hasData: boolean;
  blockers: string[];
  readyToLock: boolean;
}

interface SectionDef {
  key: string;
  labelKey: string;
  bucket: "assets" | "liabilities" | "equity";
  groups: readonly string[];
}

const SECTION_DEFS: readonly SectionDef[] = [
  { key: "cash-banks", labelKey: "wizard.sectionCashBanks", bucket: "assets", groups: ["Other"] },
  { key: "receivables", labelKey: "wizard.sectionReceivables", bucket: "assets", groups: ["Receivable"] },
  { key: "inventory", labelKey: "wizard.sectionInventory", bucket: "assets", groups: ["Inventory"] },
  { key: "fixed-assets", labelKey: "wizard.sectionFixedAssets", bucket: "assets", groups: ["FixedAsset"] },
  { key: "payables", labelKey: "wizard.sectionPayables", bucket: "liabilities", groups: ["Payable"] },
  { key: "other-liabilities", labelKey: "wizard.sectionOtherLiabilities", bucket: "liabilities", groups: ["Other"] },
  { key: "partner-equity", labelKey: "wizard.sectionPartnerEquity", bucket: "equity", groups: ["PartnerCapital", "PartnerCurrent"] },
  { key: "other-equity", labelKey: "wizard.sectionOtherEquity", bucket: "equity", groups: ["RetainedEarnings", "OpeningBalanceEquity", "PartnerDrawings", "Other"] },
];

export function getOpeningSectionDefs(t: TranslateFn): readonly (SectionDef & { label: string })[] {
  return SECTION_DEFS.map((d) => ({ ...d, label: t(d.labelKey, { namespace: "openingBalance" }) }));
}

const toNum = (v: string | number): number => {
  if (typeof v === "number") return v;
  return parseFloat(v || "0") || 0;
};

export function deriveOpeningSnapshot(input: {
  status: OpeningMigrationStatus | null;
  position: OpeningPositionControlDto | null;
  t: TranslateFn;
}): OpeningSnapshot {
  const { status, position, t } = input;

  if (!position) {
    return {
      status,
      cutoverDate: "",
      sections: [],
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      balanced: false,
      residualApplied: false,
      hasData: false,
      blockers: [t("wizard.noOpenBalancesYet", { namespace: "openingBalance" })],
      readyToLock: false,
    };
  }

  const sectionDefs = getOpeningSectionDefs(t);
  const bucketOf = (key: SectionDef["bucket"]): PositionAccountLine[] => {
    if (key === "assets") return position.asset_detail;
    if (key === "liabilities") return position.liability_detail;
    return position.equity_detail;
  };

  const sections: OpeningSection[] = sectionDefs.map((def) => {
    const lines = bucketOf(def.bucket).filter((l) => def.groups.includes(l.group_key));
    const amount = lines.reduce((s, l) => s + toNum(l.amount), 0);
    return {
      key: def.key,
      label: def.label,
      amount,
      done: Math.abs(amount) > 0.001,
      lines: lines.map((l) => ({ code: l.code, name_ar: l.name_ar, amount: toNum(l.amount) })),
    };
  });

  const hasData = sections.some((s) => s.done);
  const blockers: string[] = [];
  if (!position.is_balanced) blockers.push(t("wizard.blockerUnbalancedEquation", { namespace: "openingBalance" }));
  for (const row of position.unreconciled_items) {
    blockers.push(t("wizard.blockerUnresolvedReconItem", { namespace: "openingBalance", vars: { label: row.label } }));
  }
  // Verification gate: a residual that was explicitly classified is valid even
  // before the plug is moved into the ledger. Only an unclassified residual
  // (no accountant decision while an amount is pending) blocks verification.
  const residualAmount = toNum(position.opening_equity_adjustment);
  const residualUnclassified = residualAmount > 0 && !position.classification;
  if (residualUnclassified) {
    blockers.push(t("wizard.blockerResidualUnclassified", { namespace: "openingBalance" }));
  }

  // Lock gate: the classified residual must additionally have been moved into
  // the ledger (residual_applied), so the 53 clearance is real.
  const residualPending = !!position.classification && !position.residual_applied && residualAmount > 0;
  const readyToLock =
    hasData &&
    position.is_balanced &&
    position.unreconciled_items.length === 0 &&
    !residualUnclassified &&
    !residualPending;

  return {
    status,
    cutoverDate: position.cutover_date,
    sections,
    totalAssets: toNum(position.total_assets),
    totalLiabilities: toNum(position.total_liabilities),
    totalEquity: toNum(position.total_equity),
    balanced: position.is_balanced,
    residualApplied: position.residual_applied,
    hasData,
    blockers,
    readyToLock,
  };
}
