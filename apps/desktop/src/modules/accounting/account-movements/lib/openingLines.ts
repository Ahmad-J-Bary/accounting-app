import type { AccountLedgerLineDto, OpeningEntryDto } from "@erp/shared-types";
import { toLocalDateStr } from "@shared/lib/format";

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

// Convert backend `opening_entries` (accounts with a static opening balance)
// into line-shaped objects so they can be rendered as individual rows and
// recognized by `isOpeningLine` (journal_type "رصيد افتتاحي").
export function openingEntriesToLines(
  entries: OpeningEntryDto[],
): AccountLedgerLineDto[] {
  return entries.map((oe) => ({
    date: oe.date,
    journal_id: "",
    entry_number: oe.entry_number,
    journal_type: "رصيد افتتاحي",
    source_id: null,
    description: oe.description,
    opposite_account_name: "",
    currency: "",
    fx_rate: "0",
    debit_base: oe.debit_base,
    credit_base: oe.credit_base,
    balance_base: "0",
    debit_original: "0",
    credit_original: "0",
    balance_original: "0",
  }));
}

type OpeningEntryLike = { date?: string } | null | undefined;
type LedgerLineLike = Pick<AccountLedgerLineDto, "date" | "journal_type" | "description">;

// Earliest date (YYYY-MM-DD) at which an opening balance came into existence:
// the backend opening entry date, or the earliest opening line date.
export function getOpeningCreationDate(
  openingEntry: OpeningEntryLike,
  lines: LedgerLineLike[],
): string | null {
  let created = openingEntry?.date ? toLocalDateStr(openingEntry.date) : null;
  for (const line of lines) {
    if (isOpeningLine(line)) {
      const d = toLocalDateStr(line.date);
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
    const d = toLocalDateStr(date);
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

export type ClosingSign = "مدين" | "دائن" | "متزن";

// Closing balance = |totalDebit - totalCredit|. Its state (debit/credit) is
// decided by whichever side is larger: debit when the debit total wins,
// credit when the credit total wins, balanced when they are equal.
export function computeClosingBalance(
  totalDebit: number,
  totalCredit: number,
): { net: number; sign: ClosingSign } {
  const net = totalDebit - totalCredit;
  const sign: ClosingSign = net > 0 ? "مدين" : net < 0 ? "دائن" : "متزن";
  return { net, sign };
}
