import type { AccountDto } from "@erp/shared-types";

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

export const TYPE_LABEL: Record<string, string> = {
  Assets: "أصل",
  Liabilities: "التزام",
  Equity: "حقوق ملكية",
  Revenue: "إيراد",
  Expenses: "مصروف",
};

export const RECON_ROW_LABEL: Record<string, string> = {
  AR: "الذمم المدينة (العملاء)",
  AP: "الذمم الدائنة (الموردون)",
  Inventory: "المخزون",
  FixedAssets: "الأصول الثابتة",
  Bank: "البنوك",
  Loan: "القروض",
};

export function isDebitNature(accountType: string): boolean {
  return accountType === "Assets" || accountType === "Expenses";
}

export function findAccount(accounts: readonly AccountDto[], id: string): AccountDto | undefined {
  return accounts.find((a) => a.id === id);
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
}

/** Precise per-row mismatch message: «رصيد البنوك = 40، دفتر الأستاذ = 0». */
function mismatchMessage(row: ReconciliationRowLite): string {
  const label = RECON_ROW_LABEL[row.key] || row.key;
  return `رصيد ${label}: التفاصيل ${parseFloat(row.subledger)} ≠ دفتر الأستاذ ${parseFloat(row.general_ledger)}`;
}

/** Pure readiness calculation shared by the wizard and the reconciliation card. */
export function reconciliationReadiness(recon: ReadinessInput): Readiness {
  const controlZero = parseFloat(recon.opening_control_balance) === 0;
  const readyToPost = recon.debit_equals_credit && recon.all_reconciled;
  const readyToLock = readyToPost && controlZero;
  const rowMismatches = (recon.rows || [])
    .filter((r) => !r.reconciled)
    .map(mismatchMessage);
  const blockers = [
    !recon.debit_equals_credit && "القيد غير متوازن (مدين ≠ دائن)",
    !recon.all_reconciled && (rowMismatches.length ? rowMismatches.join(" · ") : "الواجهات الفرعية غير مطابقة"),
    !controlZero && "رصيد الافتتاح (53) لم يُصفَّر بعد",
  ].filter(Boolean) as string[];
  return { controlZero, readyToPost, readyToLock, blockers };
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
  const readiness = reconciliation ? reconciliationReadiness(reconciliation) : null;
  return readiness?.readyToPost ?? false;
}

export function readinessLabel(r: Readiness): string {
  if (r.readyToLock) return "جاهز للترحيل والقفل ✓";
  if (r.readyToPost) return "جاهز للترحيل (صفّر رصيد 53 قبل القفل)";
  return "غير جاهز: " + r.blockers.join(" · ");
}