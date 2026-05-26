import type { JournalEntryDto } from "@erp/shared-types";

/** Map each journal type to its focal account code prefix */
export const FOCUS_PREFIX: Record<string, string> = {
  CashJournal: "122",
  CashSalesJournal: "311",
  CreditSalesJournal: "312",
  PurchaseJournal: "41",
  PurchaseCostsJournal: "41",
};

const isOriginalAmount = (currencyCode?: string, fxRate?: string) => {
  const rate = parseFloat(fxRate || "1");
  return Boolean(currencyCode) && Math.abs(rate - 1) > Number.EPSILON;
};

export interface JournalRow {
  entry_number: string;
  journal_type_display: string;
  description: string;
  entry_date: string;
  debit_original: number;
  debit_base: number;
  credit_original: number;
  credit_base: number;
  debit_account: string;
  credit_account: string;
  active_side: "debit" | "credit";
  /** Original currency if all original-amount lines share the same non-base currency. */
  currency?: string;
}

export function toJournalRow(
  entry: JournalEntryDto,
  journalType?: string,
): JournalRow {
  const prefix = journalType ? FOCUS_PREFIX[journalType] : null;

  let dOriginal = 0;
  let cOriginal = 0;
  let dBase = 0;
  let cBase = 0;
  let dAcc = "-";
  let cAcc = "-";
  let activeSide: "debit" | "credit" = "debit";
  let journalTypeDisplay = entry.journal_type_display;

  if (
    entry.journal_type === "CashSalesJournal" ||
    entry.journal_type === "CreditSalesJournal"
  ) {
    journalTypeDisplay = "مبيعات نقدية";
  }

  if (prefix) {
    const focal = entry.lines.filter((l) => l.account_code?.startsWith(prefix));
    const other = entry.lines.filter(
      (l) => !l.account_code?.startsWith(prefix),
    );

    for (const l of focal) {
      const d = parseFloat(l.debit || "0");
      const c = parseFloat(l.credit || "0");
      const rate = parseFloat(l.fx_rate || "1");
      dBase += l.debit_base !== undefined ? parseFloat(l.debit_base) : (rate > 0 ? d / rate : d);
      cBase += l.credit_base !== undefined ? parseFloat(l.credit_base) : (rate > 0 ? c / rate : c);
      if (isOriginalAmount(l.currency, l.fx_rate)) {
        dOriginal += d;
        cOriginal += c;
      }
    }

    activeSide = cOriginal > 0 || cBase > 0 ? "credit" : "debit";

    if (activeSide === "credit") {
      cAcc = focal.length ? focal[0].account_name || focal[0].account_id : cAcc;
      dAcc = other.length ? other[0].account_name || other[0].account_id : dAcc;
    } else {
      dAcc = focal.length ? focal[0].account_name || focal[0].account_id : dAcc;
      cAcc = other.length ? other[0].account_name || other[0].account_id : cAcc;
    }
  } else {
    entry.lines.forEach((l) => {
      const d = parseFloat(l.debit || "0");
      const c = parseFloat(l.credit || "0");
      const rate = parseFloat(l.fx_rate || "1");
      dBase += l.debit_base !== undefined ? parseFloat(l.debit_base) : (rate > 0 ? d / rate : d);
      cBase += l.credit_base !== undefined ? parseFloat(l.credit_base) : (rate > 0 ? c / rate : c);
      if (isOriginalAmount(l.currency, l.fx_rate)) {
        dOriginal += d;
        cOriginal += c;
      }
    });

    const debits = entry.lines.filter((l) => parseFloat(l.debit || "0") > 0);
    const credits = entry.lines.filter((l) => parseFloat(l.credit || "0") > 0);

    if (debits.length > 0 || credits.length > 0) {
      if (entry.journal_type === "PurchaseJournal" && credits.length > 1) {
        const supplierLine = credits.find(
          (l) => !l.account_code?.startsWith("122"),
        );
        cAcc = supplierLine
          ? supplierLine.account_name || supplierLine.account_id
          : credits[0].account_name || credits[0].account_id;
      } else {
        cAcc =
          credits.length === 1
            ? credits[0].account_name || credits[0].account_id
            : credits.length > 1
              ? "حسابات متعددة"
              : "-";
      }

      if (
        (entry.journal_type === "CashSalesJournal" ||
          entry.journal_type === "CreditSalesJournal") &&
        debits.length > 1
      ) {
        const customerLine = debits.find(
          (l) => !l.account_code?.startsWith("122"),
        );
        dAcc = customerLine
          ? customerLine.account_name || customerLine.account_id
          : debits[0].account_name || debits[0].account_id;
      } else {
        dAcc =
          debits.length === 1
            ? debits[0].account_name || debits[0].account_id
            : debits.length > 1
              ? "حسابات متعددة"
              : "-";
      }
    } else if (entry.lines.length >= 2) {
      dAcc = entry.lines[0].account_name || entry.lines[0].account_id;
      cAcc = entry.lines[1].account_name || entry.lines[1].account_id;
    }

    const cashLine = entry.lines.find((l) => l.account_code?.startsWith("122"));
    if (
      entry.journal_type === "CashSalesJournal" ||
      entry.journal_type === "CreditSalesJournal"
    ) {
      activeSide = "credit";
    } else if (
      entry.journal_type === "PurchaseJournal" ||
      entry.journal_type === "PurchaseCostsJournal"
    ) {
      activeSide = "debit";
    } else if (
      cashLine &&
      (parseFloat(cashLine.credit || "0") > 0 ||
        parseFloat(cashLine.debit || "0") > 0)
    ) {
      activeSide = parseFloat(cashLine.credit || "0") > 0 ? "credit" : "debit";
    } else if (cOriginal > 0 || cBase > 0) {
      activeSide = dOriginal > 0 || dBase > 0 ? "debit" : "credit";
    }

    if (entry.journal_type === "MaterialOpeningBalance") {
      cAcc = "";
      dAcc = "بضاعة أول المدة";
    }
  }

  if (entry.journal_type === "PurchaseCostsJournal") {
    dAcc = "المشتريات";
    cAcc = "تكاليف إضافية للمشترات";
    activeSide = "debit";
  }

  if (activeSide === "debit") {
    cOriginal = 0;
    cBase = 0;
  } else {
    dOriginal = 0;
    dBase = 0;
  }

  // Determine original currency (if all original-amount lines share one non-base currency)
  const lineCurrencies = new Set<string>();
  entry.lines.forEach(l => {
    if (l.currency && isOriginalAmount(l.currency, l.fx_rate)) {
      lineCurrencies.add(l.currency);
    }
  });
  const origCurrencies = Array.from(lineCurrencies);
  const currency = origCurrencies.length === 1 ? origCurrencies[0] : undefined;

  return {
    entry_number: entry.entry_number,
    journal_type_display: journalTypeDisplay,
    description: entry.description,
    entry_date: entry.entry_date,
    debit_original: dOriginal,
    debit_base: dBase,
    credit_original: cOriginal,
    credit_base: cBase,
    debit_account: dAcc,
    credit_account: cAcc,
    active_side: activeSide,
    currency,
  };
}

export function aggregateEntryTotals(entries: JournalEntryDto[]) {
  const totals = {
    debitOriginal: 0,
    creditOriginal: 0,
    debitBase: 0,
    creditBase: 0,
  };
  entries.forEach((entry) => {
    entry.lines.forEach((l) => {
      const d = parseFloat(l.debit || "0");
      const c = parseFloat(l.credit || "0");
      const rate = parseFloat(l.fx_rate || "1");
      totals.debitBase += l.debit_base !== undefined ? parseFloat(l.debit_base) : (rate > 0 ? d / rate : d);
      totals.creditBase += l.credit_base !== undefined ? parseFloat(l.credit_base) : (rate > 0 ? c / rate : c);
      if (isOriginalAmount(l.currency, l.fx_rate)) {
        totals.debitOriginal += d;
        totals.creditOriginal += c;
      }
    });
  });
  return totals;
}

export function aggregateTotals(rows: JournalRow[]) {
  const totals = {
    debitOriginal: 0,
    creditOriginal: 0,
    debitBase: 0,
    creditBase: 0,
  };
  rows.forEach((r) => {
    totals.debitOriginal += r.debit_original;
    totals.creditOriginal += r.credit_original;
    totals.debitBase += r.debit_base;
    totals.creditBase += r.credit_base;
  });
  return totals;
}
