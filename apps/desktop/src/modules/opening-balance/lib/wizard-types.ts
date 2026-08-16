// Shared wizard types, constants and tiny pure helpers. Kept separate from the
// orchestration hook so components can import them without pulling in queries.

export const KIND_AR = "AR";
export const KIND_AP = "AP";
export const KIND_INVENTORY = "Inventory";
export const KIND_FIXED_ASSET = "FixedAsset";
export const KIND_BANK = "Bank";
export const KIND_LOAN = "Loan";

export const START_MODE_NEW = "NewCompany";
export const START_MODE_EXISTING = "ExistingCompanyMigration";

// Company type (persisted in settings.accounting_start_mode, formerly called
// "أسلوب بدء المحاسبة"). Semantic aliases used by the setup screen and the
// company-lifecycle derivation; the START_MODE_* names remain as legacy alias.
export const COMPANY_TYPE_NEW = START_MODE_NEW;
export const COMPANY_TYPE_EXISTING = START_MODE_EXISTING;

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