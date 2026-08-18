import type { AccountLedgerLineDto } from "@erp/shared-types";
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

type LedgerLineAmountLike = Pick<AccountLedgerLineDto, "journal_type" | "description" | "date" | "debit_base" | "credit_base">;

// Aggregated opening debit/credit within the optional date range (from, to),
// across the POSTED opening journal lines in `lines`. The posted opening
// journal IS the single GL movement — there are no synthetic opening
// rows, so this must never aggregate opening metadata on top of the lines.
export function getOpeningTotals(
  lines: LedgerLineAmountLike[],
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

  return { debit, credit };
}

// Beginning balance (قبل from_date). The POSTED opening journal line is the
// movement that establishes the beginning; static `opening_balance` metadata
// is a fallback used ONLY when no opening journal line exists at all.
export function computeOpeningBalance(
  lines: LedgerLineAmountLike[],
  staticBase: number,
  fromDate?: string,
  toDate?: string,
): number {
  const hasOpeningLine = lines.some(isOpeningLine);
  let base = 0;

  if (!hasOpeningLine) {
    base = staticBase;
  } else if (toDate) {
    // The opening journal after the report end means the account did not exist
    // yet in the period — the beginning balance is zero, never the static seed.
    const created = getOpeningCreationDate(null, lines);
    if (created && created > toDate) {
      base = 0;
    }
  }

  if (!fromDate) return base;

  let debitBefore = 0;
  let creditBefore = 0;
  for (const line of lines) {
    const d = toLocalDateStr(line.date);
    if (d < fromDate) {
      debitBefore += parseFloat(line.debit_base || "0");
      creditBefore += parseFloat(line.credit_base || "0");
    }
  }
  return base + debitBefore - creditBefore;
}

// Running balance (الرصيد الجاري) per row in display order, seeded by the
// beginning balance (`openingBalance`) and accumulating Dr − Cr per line.
// The seed is the pre-range beginning; each posted line moves it by its own
// debit/credit effect — so a single opening movement of 80 yields [80], never
// [160], and reversal pairs (excluded upstream) can never double it.
export function computeRunningBalance(
  lines: LedgerLineAmountLike[],
  openingBalance: number,
): number[] {
  const running: number[] = [];
  let balance = openingBalance;
  for (const line of lines) {
    balance += parseFloat(line.debit_base || "0") - parseFloat(line.credit_base || "0");
    running.push(balance);
  }
  return running;
}

export type ClosingSign = "مدين" | "دائن" | "متزن";

/**
 * Flags each row of a ledger-light list with whether it is the FIRST row of an
 * adjacent run sharing the same journal (`journal_id`). A journal that spans
 * several accounts (e.g. the residual reclassification: Dr 53 / Cr 52 of one
 * GeneralJournal) then renders entry-number / type / date once, under one
 * "journal header", while every movement row stays visible.
 */
export function markEntryRunFirsts(lines: { journal_id: string }[]): boolean[] {
  return lines.map((line, idx) => idx === 0 || line.journal_id !== lines[idx - 1].journal_id);
}

type JournalGroupable = { journal_id: string };

/**
 * Groups ledger rows by the owning journal (`journal_id`) KEY, preserving
 * first-seen order. One visual header is then shared by every line of a
 * multi-line journal (e.g. the 11-line opening migration or the 2-line
 * residual reclassification) regardless of the applied sort, because grouping
 * is by identity — never by row adjacency. Rows sharing a journal_id always
 * land in the same group; a row with an empty journal_id (e.g. the synthetic
 * "رصيد سابق / أول الفترة" beginning row) becomes its own singleton group.
 */
export function groupMovementLinesByJournal<T extends JournalGroupable>(lines: T[]): T[][] {
  const groups: T[][] = [];
  const byJournal = new Map<string, T[]>();
  for (const line of lines) {
    let group = byJournal.get(line.journal_id);
    if (!group) {
      group = [];
      byJournal.set(line.journal_id, group);
      groups.push(group);
    }
    group.push(line);
  }
  return groups;
}

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
