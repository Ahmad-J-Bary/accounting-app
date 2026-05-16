import type { JournalEntryDto } from "@erp/shared-types";

/** Map each journal type to its focal account code prefix */
export const FOCUS_PREFIX: Record<string, string> = {
  CashJournal: '122',
  CashSalesJournal: '311',
  CreditSalesJournal: '312',
  PurchaseJournal: '41',
  PurchaseCostsJournal: '221',
};

export interface JournalRow {
  entry_number: string;
  journal_type_display: string;
  description: string;
  entry_date: string;
  debit_usd: number;
  debit_syp: number;
  credit_usd: number;
  credit_syp: number;
  debit_account: string;
  credit_account: string;
}

/**
 * Transform a JournalEntryDto into a display row for the journal table.
 *
 * For specialized journals (CashJournal, PurchaseJournal, etc.), the focal
 * account is identified and its side alone is shown — the opposite column
 * is empty (no amount) and shows the counterparty account name.
 *
 * For the general journal, all lines are aggregated.
 */
export function toJournalRow(entry: JournalEntryDto, journalType?: string): JournalRow {
  const prefix = journalType ? FOCUS_PREFIX[journalType] : null;
  const isFocal = !!prefix;

  let dUSD = 0, cUSD = 0, dSYP = 0, cSYP = 0;
  let dAcc = "-", cAcc = "-";

  if (isFocal) {
    // --- Specialised journal: only the focal account's side ---
    const focal = entry.lines.filter(l => l.account_code?.startsWith(prefix));
    const other = entry.lines.filter(l => !l.account_code?.startsWith(prefix));

    const focalDebit  = focal.find(l => parseFloat(l.debit || "0")  > 0);
    const focalCredit = focal.find(l => parseFloat(l.credit || "0") > 0);
    const otherDebit  = other.find(l => parseFloat(l.debit || "0")  > 0);
    const otherCredit = other.find(l => parseFloat(l.credit || "0") > 0);

    if (focalDebit) {
      // Focal account is debtor → "عليه/مدين" gets the amount
      const fx = parseFloat(focalDebit.fx_rate || "1");
      dUSD = focalDebit.currency === 'USD' ? parseFloat(focalDebit.debit) : 0;
      dSYP = parseFloat(focalDebit.debit || "0") * fx;
      dAcc = focalDebit.account_name || focalDebit.account_id;
      // The credit side shows the counterparty
      cAcc = otherCredit?.account_name || otherCredit?.account_id || cAcc;
    } else if (focalCredit) {
      // Focal account is creditor → "له/دائن" gets the amount
      const fx = parseFloat(focalCredit.fx_rate || "1");
      cUSD = focalCredit.currency === 'USD' ? parseFloat(focalCredit.credit) : 0;
      cSYP = parseFloat(focalCredit.credit || "0") * fx;
      cAcc = focalCredit.account_name || focalCredit.account_id;
      // The debit side shows the counterparty
      dAcc = otherDebit?.account_name || otherDebit?.account_id || dAcc;
    } else {
      // Focal account not involved in this entry → show nothing
      // (this shouldn't happen if backend filtering is correct)
    }
  } else {
    // --- General journal: aggregate ALL lines ---
    entry.lines.forEach(l => {
      const d = parseFloat(l.debit || "0"), c = parseFloat(l.credit || "0");
      const fx = parseFloat(l.fx_rate || "1");
      if (l.currency === 'USD') { dUSD += d; cUSD += c; dSYP += d * fx; cSYP += c * fx; }
      else { dSYP += d; cSYP += c; }
    });

    const debits  = entry.lines.filter(l => parseFloat(l.debit || "0")  > 0);
    const credits = entry.lines.filter(l => parseFloat(l.credit || "0") > 0);
    dAcc = debits.length  === 1 ? (debits[0].account_name  || debits[0].account_id)
        : debits.length   > 1 ? "حسابات متعددة" : "-";
    cAcc = credits.length === 1 ? (credits[0].account_name || credits[0].account_id)
        : credits.length  > 1 ? "حسابات متعددة" : "-";
  }

  return {
    entry_number: entry.entry_number,
    journal_type_display: entry.journal_type_display,
    description: entry.description,
    entry_date: entry.entry_date,
    debit_usd: dUSD, debit_syp: dSYP,
    credit_usd: cUSD, credit_syp: cSYP,
    debit_account: dAcc,
    credit_account: cAcc,
  };
}

/** Aggregated totals helper */
export function aggregateTotals(rows: JournalRow[]) {
  const t = { debitUSD: 0, creditUSD: 0, debitSYP: 0, creditSYP: 0 };
  rows.forEach(r => {
    t.debitUSD  += r.debit_usd;
    t.creditUSD += r.credit_usd;
    t.debitSYP  += r.debit_syp;
    t.creditSYP += r.credit_syp;
  });
  return t;
}
