/**
 * Accounting Entry Classifier — Single Source of Truth
 *
 * This module replaces 5+ independent opening-entry detection implementations,
 * 7+ inventory account detection patterns, and 3+ credit-nature checks scattered
 * across the reporting layer. Every report now delegates to these canonical
 * functions instead of re-implementing the classification logic.
 *
 * Rules:
 * - NEVER use description.includes() for classification
 * - NEVER use Arabic keyword matching as the PRIMARY classifier
 * - ALWAYS prefer structured fields (source_id, journal_type, purpose) first
 * - Arabic name fallbacks are allowed ONLY for display/account-selection purposes
 */

// ─── Opening Entry Detection ────────────────────────────────────────────────

/** Canonical source_id prefixes that identify opening-migration entries. */
const OPENING_SOURCE_PREFIXES = [
  "opening_balance:",
  "residual_classification:",
  "ob_reversal:",
] as const;

/** Canonical journal_type values that identify opening-balance entries. */
const OPENING_JOURNAL_TYPES = new Set([
  "CashOpeningBalance",
  "AccountOpeningBalance",
  "MaterialOpeningBalance",
]);

/**
 * Minimal shape required for opening-entry detection.
 * Works with JournalEntryDto, AccountLedgerLineDto, or any compatible object.
 */
interface OpeningDetectable {
  source_id?: string | null;
  journal_type?: string;
  is_opening?: boolean;
}

/**
 * Canonical opening-entry detection. A journal entry is an "opening" entry if:
 *
 * 1. The backend explicitly marks it (`is_opening === true`), OR
 * 2. Its `source_id` belongs to the opening-migration workflow, OR
 * 3. Its `journal_type` is one of the three opening-balance types.
 *
 * NEVER falls back to description keyword matching — a normal post-opening
 * transaction that mentions "رصيد افتتاحي" in its description is NOT an
 * opening entry.
 */
export function isOpeningEntry(entry: OpeningDetectable): boolean {
  if (entry.is_opening === true) return true;

  const source = entry.source_id || "";
  if (OPENING_SOURCE_PREFIXES.some((prefix) => source.startsWith(prefix))) {
    return true;
  }

  if (entry.journal_type && OPENING_JOURNAL_TYPES.has(entry.journal_type)) {
    return true;
  }

  return false;
}

// ─── Inventory Account Detection ────────────────────────────────────────────

/**
 * Minimal shape required for inventory-account detection.
 * Works with AccountDto, AccountBalance, or any compatible object.
 */
interface InventoryDetectable {
  purpose?: string | null;
  name_ar?: string;
  name?: string;
}

/**
 * Canonical inventory-account detection. An account is an inventory account if:
 *
 * 1. Its `purpose` field is `"inventory"` (the structured, canonical field), OR
 * 2. Its Arabic name contains inventory-related keywords (fallback only).
 *
 * The purpose field is the primary classifier. Arabic name matching is a
 * fallback for accounts that predate the purpose column or have not been
 * backfilled yet.
 */
export function isInventoryAccount(account: InventoryDetectable): boolean {
  if (account.purpose === "inventory") return true;

  const name = account.name_ar || account.name || "";
  return (
    name.includes("بضاعة أول المدة") ||
    name.includes("بضاعة آخر المدة") ||
    name.includes("مخزون")
  );
}

/**
 * Inventory trading accounts that appear in the Income Statement, NOT the
 * Balance Sheet. These are the COGS accounts (opening/closing stock) that
 * must be excluded from the balance sheet's current-assets section.
 */
export function isInventoryTradingAccount(name: string): boolean {
  return name.includes("بضاعة أول المدة") || name.includes("بضاعة آخر المدة");
}

// ─── Account Nature / Credit-Nature ─────────────────────────────────────────

const CREDIT_NORMAL_TYPES = new Set(["Liabilities", "Equity", "Revenue"]);

/**
 * Whether an account type is credit-normal (Liabilities, Equity, Revenue).
 * Credit-normal accounts carry their balance on the credit side and increase
 * with credits. Debit-normal accounts (Assets, Expenses) carry on the debit
 * side and increase with debits.
 */
export function isCreditNatureAccount(accountType?: string): boolean {
  return !!accountType && CREDIT_NORMAL_TYPES.has(accountType);
}

/**
 * Normal-balance sign multiplier: +1 for credit-normal accounts,
 * -1 for debit-normal accounts.
 */
export function normalSign(accountType?: string): 1 | -1 {
  return isCreditNatureAccount(accountType) ? 1 : -1;
}

// ─── Purpose-to-Account-Type Fallback ───────────────────────────────────────

export type GlAccountType = "Assets" | "Liabilities" | "Equity" | "Revenue" | "Expenses";

/**
 * Maps `account_purpose` to a GL account type. Used as a fallback when the
 * enriched `account_type` is not available on a journal line.
 */
export function purposeTypeFallback(accountPurpose?: string): GlAccountType | undefined {
  if (!accountPurpose) return undefined;
  if (accountPurpose === "receivable" || accountPurpose === "inventory" || accountPurpose === "bank") {
    return "Assets";
  }
  if (accountPurpose === "payable" || accountPurpose === "loan") {
    return "Liabilities";
  }
  if (
    accountPurpose === "partner_capital" ||
    accountPurpose === "partner_drawings" ||
    accountPurpose === "partner_current" ||
    accountPurpose === "retained_earnings" ||
    accountPurpose === "opening_balance_equity" ||
    accountPurpose === "opening_equity_adjustment" ||
    accountPurpose === "prior_period_adjustment" ||
    accountPurpose === "other_equity"
  ) {
    return "Equity";
  }
  return undefined;
}
