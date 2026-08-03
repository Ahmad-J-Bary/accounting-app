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

type OpeningEntryLike = { date?: string } | null | undefined;
type LedgerLineLike = Pick<AccountLedgerLineDto, "date" | "journal_type" | "description">;

// Earliest date (YYYY-MM-DD) at which an opening balance came into existence:
// the backend opening entry date, or the earliest opening line date.
export function getOpeningCreationDate(
  openingEntry: OpeningEntryLike,
  lines: LedgerLineLike[],
): string | null {
  let created = openingEntry?.date?.split("T")[0] || null;
  for (const line of lines) {
    if (isOpeningLine(line)) {
      const d = line.date.split("T")[0];
      if (!created || d < created) created = d;
    }
  }
  return created;
}
