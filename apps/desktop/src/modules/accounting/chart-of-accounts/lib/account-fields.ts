/**
 * Pure helpers for building the single COA detail grid.
 *
 * The Chart of Accounts view used to render TWO grids (بيانات الحساب and
 * بيانات العميل/المورد/الشريك) that duplicated العملة and الرصيد. These
 * helpers merge the account grid with the linked-entity grid into ONE grid and
 * drop the duplicates: when a linked entity carries its own working currency /
 * current balance, the account-side copies are removed.
 */

export type LinkedEntityKind = "customer" | "supplier" | "partner";

export type PartnerAccountRole = "capital" | "drawings" | "current";

export interface AccountField {
  /** Stable key used to detect duplicates across the account/entity grids. */
  key: string;
  label: string;
  value: string;
}

export function toDetailFields(fields: AccountField[]): Array<{ label: string; value: string }> {
  return fields.map(({ label, value }) => ({ label, value }));
}

/**
 * Merges the account grid with the linked-entity grid into a single field list.
 *
 * Dedup rules:
 * - customer / supplier: the entity grid carries the working balance (and no
 *   entity-side currency field), so the account-side العملة / الرصيد copies
 *   are always dropped.
 * - partner-capital: the partner panel shows the CAPITAL amounts (المبلغ
 *   المشارك به / المبلغ)، not a working balance, so the account-side copies
 *   are dropped and the capital fields take their place.
 * - partner drawings / current: operational accounts with a real ledger
 *   balance — the account-side العملة / الرصيد stay; only the identity fields
 *   are merged on top.
 */
export function mergeAccountEntityFields(
  accountFields: AccountField[],
  entityFields: AccountField[],
  entityKind: LinkedEntityKind | null,
  partnerRole: PartnerAccountRole | null = null,
  hasMultipleCurrencies = false,
): AccountField[] {
  const isPartnerCapital =
    entityKind === "partner" && (partnerRole ?? "capital") === "capital";

  const dropFinancial =
    entityKind === "customer" ||
    entityKind === "supplier" ||
    isPartnerCapital;

  const merged: AccountField[] = [];

  for (const field of accountFields) {
    if (field.key === "account-currency" && !hasMultipleCurrencies) {
      continue;
    }
    const isFinancial =
      field.key === "account-currency" || field.key === "account-balance";
    if (dropFinancial && isFinancial) continue;
    merged.push(field);
  }

  for (const field of entityFields) {
    merged.push(field);
  }

  return merged;
}