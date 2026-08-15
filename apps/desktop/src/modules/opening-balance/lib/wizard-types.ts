// Shared wizard types, constants and tiny pure helpers. Kept separate from the
// orchestration hook so components can import them without pulling in queries.

export const KIND_AR = "AR";
export const KIND_AP = "AP";
export const KIND_INVENTORY = "Inventory";
export const KIND_FIXED_ASSET = "FixedAsset";

export const START_MODE_NEW = "NewCompany";
export const START_MODE_EXISTING = "ExistingCompanyMigration";

// Opening Balance Equity control account (code 53) — the residual plug.
export const OPENING_EQUITY_CODE = "53";

export interface WizLine {
  key: string;
  account_id: string;
  amount: string;
  kind?: "cash" | "bank" | "loan" | "manual";
}

// A read-only line DERIVED from an owning module (customers / suppliers /
// fixed assets / partners). Shown with a "مشتق" badge; never manually edited.
export interface DerivedRow {
  key: string;
  entity_id: string;
  label: string;
  account_id: string;
  account_code: string;
  amount: string;
  kind: "AR" | "AP" | "FixedAsset" | "Equity";
}

export function newLine(): WizLine {
  return { key: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, account_id: "", amount: "" };
}

export function toNum(v?: string): number {
  return parseFloat(v || "0") || 0;
}