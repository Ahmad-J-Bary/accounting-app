import type { AccountLedgerLineDto } from "@erp/shared-types";

export function isOpeningLine(l: Pick<AccountLedgerLineDto, "journal_type" | "description">): boolean {
  const desc = l.description || "";
  return (
    l.journal_type === "AccountOpeningBalance" ||
    l.journal_type === "CashOpeningBalance" ||
    l.journal_type === "MaterialOpeningBalance" ||
    l.journal_type === "رصيد افتتاحي" ||
    l.journal_type === "رصيد افتتاحي لحساب" ||
    l.journal_type === "رصيد افتتاحي للخزينة" ||
    desc.includes("رصيد افتتاحي") ||
    desc.includes("أول المدة")
  );
}
