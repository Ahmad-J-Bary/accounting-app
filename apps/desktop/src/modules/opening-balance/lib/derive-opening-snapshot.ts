// Derive the opening dashboard snapshot from the persisted opening
// position-control data. Pure and data-driven (no live wizard state): every
// section amount comes from the migration's account-bucketed detail lines, so
// the overview tab reads the same truth the backend reports.

import type { OpeningPositionControlDto, PositionAccountLine } from "@erp/shared-types";
import type { OpeningMigrationStatus } from "../../accounting/api/openingBalanceService";

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
  label: string;
  bucket: "assets" | "liabilities" | "equity";
  groups: readonly string[];
}

export const OPENING_SECTION_DEFS: readonly SectionDef[] = [
  { key: "cash-banks", label: "النقد والبنوك", bucket: "assets", groups: ["Other"] },
  { key: "receivables", label: "الذمم المدينة (العملاء)", bucket: "assets", groups: ["Receivable"] },
  { key: "inventory", label: "المخزون", bucket: "assets", groups: ["Inventory"] },
  { key: "fixed-assets", label: "الأصول الثابتة", bucket: "assets", groups: ["FixedAsset"] },
  { key: "payables", label: "الذمم الدائنة (الموردون)", bucket: "liabilities", groups: ["Payable"] },
  { key: "other-liabilities", label: "الالتزامات الأخرى", bucket: "liabilities", groups: ["Other"] },
  { key: "partner-equity", label: "رؤوس أموال الشركاء", bucket: "equity", groups: ["PartnerCapital", "PartnerCurrent"] },
  { key: "other-equity", label: "حقوق الملكية الأخرى", bucket: "equity", groups: ["RetainedEarnings", "OpeningBalanceEquity", "PartnerDrawings", "Other"] },
];

const toNum = (v: string | number): number => {
  if (typeof v === "number") return v;
  return parseFloat(v || "0") || 0;
};

export function deriveOpeningSnapshot(input: {
  status: OpeningMigrationStatus | null;
  position: OpeningPositionControlDto | null;
}): OpeningSnapshot {
  const { status, position } = input;

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
      blockers: ["لم تُرصد أي أرصدة بعد"],
      readyToLock: false,
    };
  }

  const bucketOf = (key: SectionDef["bucket"]): PositionAccountLine[] => {
    if (key === "assets") return position.asset_detail;
    if (key === "liabilities") return position.liability_detail;
    return position.equity_detail;
  };

  const sections: OpeningSection[] = OPENING_SECTION_DEFS.map((def) => {
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
  if (!position.is_balanced) blockers.push("المعادلة غير متوازنة (الأصول ≠ الخصوم + حقوق الملكية)");
  for (const row of position.unreconciled_items) {
    blockers.push(`رقم مطابقة غير محلول: ${row.label}`);
  }
  // Verification gate: a residual that was explicitly classified is valid even
  // before the plug is moved into the ledger. Only an unclassified residual
  // (no accountant decision while an amount is pending) blocks verification.
  const residualAmount = toNum(position.opening_equity_adjustment);
  const residualUnclassified = residualAmount > 0 && !position.classification;
  if (residualUnclassified) {
    blockers.push("الرصيد المتبقي (53) غير مصنّف بعد");
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