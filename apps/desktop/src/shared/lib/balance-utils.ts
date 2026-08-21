/**
 * Centralized balance direction math for partner accounts.
 *
 * Business rule: customer balances are "debit-first" (positive = مدين),
 * supplier balances are "credit-first" (positive = دائن).
 * This is a display convention, not an accounting-law change.
 */

/** Sign multiplier for partner type: customer = 1, supplier = -1. */
export function partnerDirectionMultiplier(
  partnerType: "customer" | "supplier"
): 1 | -1 {
  return partnerType === "customer" ? 1 : -1;
}

/**
 * Effective balance adjusted by partner type.
 *
 * - Customer: `debit - credit` (positive = مدين)
 * - Supplier: `credit - debit` (positive = دائن)
 */
export function effectiveBalance(
  debit: number,
  credit: number,
  partnerType: "customer" | "supplier"
): number {
  return ((debit - credit) * partnerDirectionMultiplier(partnerType)) || 0;
}

/**
 * Effective balance converted to base currency.
 *
 * Falls back to the raw `balance` field when `debit`/`credit` are unavailable
 * (e.g. expense accounts that only store a net balance).
 */
export function effectiveBalanceBase(
  debit: number | undefined,
  credit: number | undefined,
  balance: number,
  partnerType: "customer" | "supplier"
): number {
  if (debit !== undefined && credit !== undefined) {
    return (Number(debit || 0) - Number(credit || 0)) *
      partnerDirectionMultiplier(partnerType);
  }
  return Number(balance || 0);
}

/** Arabic direction label: "مدين", "دائن", or "—" when zero. */
export function balanceDirectionLabel(
  debit: number,
  credit: number,
  partnerType: "customer" | "supplier"
): string {
  const bal = effectiveBalance(debit, credit, partnerType);
  if (bal > 0) return "مدين";
  if (bal < 0) return "دائن";
  return "—";
}

/** Arabic direction status (no zero case). */
export function balanceDirectionStatus(
  debit: number,
  credit: number,
  partnerType: "customer" | "supplier"
): "مدين" | "دائن" | null {
  const bal = effectiveBalance(debit, credit, partnerType);
  if (bal > 0) return "مدين";
  if (bal < 0) return "دائن";
  return null;
}
