import type { JournalEntryDto } from "@erp/shared-types";

/** Map each journal type to its focal account code prefix */
export const FOCUS_PREFIX: Record<string, string> = {
  CashJournal: '122',
  CashSalesJournal: '311',
  CreditSalesJournal: '312',
  PurchaseJournal: '41',
  PurchaseCostsJournal: '41',
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
  /** Which side's amounts are visible — the other side is hidden */
  active_side: 'debit' | 'credit';
}

/**
 * Transform a JournalEntryDto into a display row for the journal table.
 *
 * For specialized journals (CashJournal, PurchaseJournal, etc.), the focal
 * account is identified and its side alone is shown — the opposite side's
 * amounts are hidden and the counterparty account name appears in the
 * opposite column.
 *
 * For the general journal, amounts appear on only ONE side per row
 * (debit if any debit exists, otherwise credit). This avoids showing
 * duplicated mirror amounts for balanced entries.
 */
export function toJournalRow(entry: JournalEntryDto, journalType?: string): JournalRow {
  const prefix = journalType ? FOCUS_PREFIX[journalType] : null;

  let dUSD = 0, cUSD = 0, dSYP = 0, cSYP = 0;
  let dAcc = "-", cAcc = "-";
  let activeSide: 'debit' | 'credit' = 'debit';

  if (prefix) {
    // --- Specialised journal: only the focal account's side ---
    const focal = entry.lines.filter(l => l.account_code?.startsWith(prefix));
    const other = entry.lines.filter(l => !l.account_code?.startsWith(prefix));

    // Aggregate all focal lines for determining amounts on that side
    for (const l of focal) {
      const d = parseFloat(l.debit || "0"), c = parseFloat(l.credit || "0");
      const fx = parseFloat(l.fx_rate || "1");
      const isUSD = l.currency === 'USD';
      dUSD += isUSD ? d : 0;
      dSYP += isUSD ? d * fx : d;
      cUSD += isUSD ? c : 0;
      cSYP += isUSD ? c * fx : c;
    }

    activeSide = cUSD > 0 || cSYP > 0 ? 'credit' : 'debit';

    if (activeSide === 'credit') {
      cAcc = focal.length ? (focal[0].account_name || focal[0].account_id) : cAcc;
      dAcc = other.length ? (other[0].account_name || other[0].account_id) : dAcc;
    } else {
      dAcc = focal.length ? (focal[0].account_name || focal[0].account_id) : dAcc;
      cAcc = other.length ? (other[0].account_name || other[0].account_id) : cAcc;
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

    if (debits.length > 0 || credits.length > 0) {
      if (entry.journal_type === 'PurchaseJournal' && credits.length > 1) {
        const supplierLine = credits.find(l => !l.account_code?.startsWith('122'));
        cAcc = supplierLine ? (supplierLine.account_name || supplierLine.account_id) : (credits[0].account_name || credits[0].account_id);
      } else {
        cAcc = credits.length === 1 ? (credits[0].account_name || credits[0].account_id)
            : credits.length  > 1 ? "حسابات متعددة" : "-";
      }

      if ((entry.journal_type === 'CashSalesJournal' || entry.journal_type === 'CreditSalesJournal') && debits.length > 1) {
        const customerLine = debits.find(l => !l.account_code?.startsWith('122'));
        dAcc = customerLine ? (customerLine.account_name || customerLine.account_id) : (debits[0].account_name || debits[0].account_id);
      } else {
        dAcc = debits.length  === 1 ? (debits[0].account_name  || debits[0].account_id)
            : debits.length   > 1 ? "حسابات متعددة" : "-";
      }
    } else if (entry.lines.length >= 2) {
      dAcc = entry.lines[0].account_name || entry.lines[0].account_id;
      cAcc = entry.lines[1].account_name || entry.lines[1].account_id;
    }

    // Show amounts on the side of the cash account if present,
    // otherwise show debit when both sides have amounts.
    const cashLine = entry.lines.find(l => l.account_code?.startsWith('122'));
    if (entry.journal_type === 'PurchaseJournal' || entry.journal_type === 'PurchaseCostsJournal') {
      activeSide = 'debit';
    } else if (cashLine && (parseFloat(cashLine.credit || "0") > 0 || parseFloat(cashLine.debit || "0") > 0)) {
      activeSide = parseFloat(cashLine.credit || "0") > 0 ? 'credit' : 'debit';
    } else if (cUSD > 0 || cSYP > 0) {
      if (dUSD > 0 || dSYP > 0) {
        // Both sides have amounts → show debit, hide credit
        activeSide = 'debit';
      } else {
        // Only credit has amounts
        activeSide = 'credit';
      }
    }
    // else both zero → default activeSide = 'debit' (shows 0 amounts)

    // MaterialOpeningBalance: hide the credit account and show fixed debit account
    if (entry.journal_type === 'MaterialOpeningBalance') {
      cAcc = "";
      dAcc = "بضاعة أول المدة";
    }
  }

  // PurchaseCostsJournal: fixed account names regardless of filter view
  if (entry.journal_type === 'PurchaseCostsJournal') {
    dAcc = "المشتريات";
    cAcc = "تكاليف إضافية للمشترات";
    activeSide = 'debit';
  }

  // Zero out the inactive side
  if (activeSide === 'debit') { cUSD = 0; cSYP = 0; }
  else { dUSD = 0; dSYP = 0; }

  return {
    entry_number: entry.entry_number,
    journal_type_display: entry.journal_type_display,
    description: entry.description,
    entry_date: entry.entry_date,
    debit_usd: dUSD, debit_syp: dSYP,
    credit_usd: cUSD, credit_syp: cSYP,
    debit_account: dAcc,
    credit_account: cAcc,
    active_side: activeSide,
  };
}

/** Aggregated totals from raw entry data (both sides, for the summary footer) */
export function aggregateEntryTotals(entries: JournalEntryDto[]) {
  const t = { debitUSD: 0, creditUSD: 0, debitSYP: 0, creditSYP: 0 };
  entries.forEach(entry => {
    entry.lines.forEach(l => {
      const d = parseFloat(l.debit || "0"), c = parseFloat(l.credit || "0");
      const fx = parseFloat(l.fx_rate || "1");
      if (l.currency === 'USD') {
        t.debitUSD += d; t.creditUSD += c;
        t.debitSYP += d * fx; t.creditSYP += c * fx;
      } else {
        t.debitSYP += d; t.creditSYP += c;
      }
    });
  });
  return t;
}

/** Aggregated totals from row data (one-sided, for preview/scalar use) */
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
