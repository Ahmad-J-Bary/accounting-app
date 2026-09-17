import type { AccountDto } from "@erp/shared-types";

export type SupportedLanguage = "ar" | "en";

export interface MigrationLite {
  id: string;
  status: string;
  cutover_date: string;
}

/** Most recent non-cancelled migration — the "current" opening transition.
 * Shared by the overview dashboard and the wizard so both always read the
 * same persisted truth. */
export function selectLatestOpenMigration<T extends MigrationLite>(
  migrations: readonly T[] | null | undefined,
): T | null {
  if (!migrations || migrations.length === 0) return null;
  const open = migrations.filter((m) => m.status !== "Cancelled");
  if (open.length === 0) return null;
  return [...open].sort((a, b) => b.cutover_date.localeCompare(a.cutover_date))[0];
}

export interface AccountLine {
  key: string;
  account_id: string;
  amount: string;
  description: string;
}

export type TranslateFn = (key: string, opts?: Record<string, unknown>) => string;

export const TYPE_LABEL: Record<string, (t: TranslateFn) => string> = {
  Assets: (t) => t("wizard.typeAsset", { namespace: "openingBalance" }),
  Liabilities: (t) => t("wizard.typeLiability", { namespace: "openingBalance" }),
  Equity: (t) => t("wizard.typeEquity", { namespace: "openingBalance" }),
  Revenue: (t) => t("wizard.typeRevenue", { namespace: "openingBalance" }),
  Expenses: (t) => t("wizard.typeExpense", { namespace: "openingBalance" }),
};

export const RECON_ROW_LABEL: Record<string, (t: TranslateFn) => string> = {
  AR: (t) => t("wizard.reconRowAR", { namespace: "openingBalance" }),
  AP: (t) => t("wizard.reconRowAP", { namespace: "openingBalance" }),
  Inventory: (t) => t("wizard.reconRowInventory", { namespace: "openingBalance" }),
  FixedAssets: (t) => t("wizard.reconRowFixedAssets", { namespace: "openingBalance" }),
  Bank: (t) => t("wizard.reconRowBanks", { namespace: "openingBalance" }),
  Loan: (t) => t("wizard.reconRowLoans", { namespace: "openingBalance" }),
};

export function isDebitNature(accountType: string): boolean {
  return accountType === "Assets" || accountType === "Expenses";
}

export function findAccount(accounts: readonly AccountDto[], id: string): AccountDto | undefined {
  return accounts.find((a) => a.id === id);
}

export function getLocalizedAccountName(
  account: Pick<AccountDto, "name_ar" | "name_en" | "code"> | null | undefined,
  language: SupportedLanguage,
): string {
  if (!account) return "";
  if (language === "ar") {
    return account.name_ar || account.name_en || account.code;
  }
  return account.name_en || account.name_ar || account.code;
}

export function getLocalizedAccountLabel(
  account: Pick<AccountDto, "code" | "name_ar" | "name_en"> | null | undefined,
  language: SupportedLanguage,
): string {
  if (!account) return "";
  return `${account.code} - ${getLocalizedAccountName(account, language)}`;
}

export interface ReconciliationRowLite {
  key: string;
  subledger: string;
  general_ledger: string;
  reconciled: boolean;
}

export interface ReadinessInput {
  debit_equals_credit: boolean;
  all_reconciled: boolean;
  opening_control_balance: string;
  rows?: ReconciliationRowLite[];
}

export interface Readiness {
  controlZero: boolean;
  readyToPost: boolean;
  readyToLock: boolean;
  blockers: string[];
  nonZeroedBlockers: string[];
}

/** Precise per-row mismatch message. */
function mismatchMessage(row: ReconciliationRowLite, t: TranslateFn): string {
  const label = RECON_ROW_LABEL[row.key]?.(t) || row.key;
  return t("wizard.reconRowMismatch", { namespace: "openingBalance", vars: { label, subledger: parseFloat(row.subledger), generalLedger: parseFloat(row.general_ledger) } });
}

/** Pure readiness calculation shared by the wizard and the reconciliation card. */
export function reconciliationReadiness(recon: ReadinessInput, t: TranslateFn): Readiness {
  const controlZero = parseFloat(recon.opening_control_balance) === 0;
  const readyToPost = recon.debit_equals_credit && recon.all_reconciled;
  const readyToLock = readyToPost && controlZero;
  const rowMismatches = (recon.rows || [])
    .filter((r) => !r.reconciled)
    .map((r) => mismatchMessage(r, t));
  const notZeroed = !controlZero ? [t("wizard.blockerNotZeroed", { namespace: "openingBalance" })] : [];
  const blockers = [
    !recon.debit_equals_credit && t("wizard.blockerUnbalanced", { namespace: "openingBalance" }),
    !recon.all_reconciled && (rowMismatches.length ? rowMismatches.join(" · ") : t("wizard.blockerSubledgerMismatch", { namespace: "openingBalance" })),
  ].filter(Boolean) as string[];
  return { controlZero, readyToPost, readyToLock, blockers, nonZeroedBlockers: notZeroed };
}

/** Verify gate for the wizard's «تأكيد التحقق» step: the migration must be
 * editable (Draft/Validated/Approved) and pass the post-readiness equations
 * (debit = credit and every sub-ledger reconciled). An unclassified residual is
 * rejected structurally (no plug line → debit ≠ credit) by the backend; the
 * frontend mirrors that gate here. */
export function canValidateOpening(
  migration: { status: string } | null,
  reconciliation: ReadinessInput | null,
): boolean {
  if (!migration) return false;
  if (["Posted", "Locked", "Cancelled"].includes(migration.status)) return false;
  const readiness = reconciliation ? reconciliationReadiness(reconciliation, (k, _o) => k) : null;
  return readiness?.readyToPost ?? false;
}

export function readinessLabel(r: Readiness, t: TranslateFn): string {
  if (r.readyToLock) return t("wizard.readyToPostAndLock", { namespace: "openingBalance" });
  if (r.readyToPost) return t("wizard.readyToPostOnly", { namespace: "openingBalance" });
  return t("wizard.notReady", { namespace: "openingBalance" }) + r.blockers.join(" · ");
}
