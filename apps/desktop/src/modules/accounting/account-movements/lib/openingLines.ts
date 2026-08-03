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

type OpeningEntryAmountLike = {
  date?: string;
  debit_base?: string;
  credit_base?: string;
};
type LedgerLineAmountLike = Pick<AccountLedgerLineDto, "journal_type" | "description" | "date" | "debit_base" | "credit_base">;

// Aggregated opening debit/credit within the optional date range (from, to),
// across all opening lines plus all opening entries. The backend guarantees no
// overlap: accounts with a static opening balance get their opening entries in
// `opening_entries` (lines are skipped), accounts without get them in `lines`.
export function getOpeningTotals(
  lines: LedgerLineAmountLike[],
  openingEntries: OpeningEntryAmountLike[] = [],
  fromDate?: string,
  toDate?: string,
): { debit: number; credit: number } {
  const inRange = (date: string): boolean => {
    const d = date.split("T")[0];
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  let debit = 0;
  let credit = 0;

  for (const line of lines) {
    if (isOpeningLine(line) && inRange(line.date)) {
      debit += parseFloat(line.debit_base || "0");
      credit += parseFloat(line.credit_base || "0");
    }
  }

  for (const openingEntry of openingEntries) {
    if (inRange(openingEntry.date || "")) {
      debit += parseFloat(openingEntry.debit_base || "0");
      credit += parseFloat(openingEntry.credit_base || "0");
    }
  }

  return { debit, credit };
}
