import type { JournalEntryDto } from "@erp/shared-types";

const isOriginalAmount = (currencyCode?: string, fxRate?: string) => {
  const rate = parseFloat(fxRate || "1");
  return Boolean(currencyCode) && Math.abs(rate - 1) > Number.EPSILON;
};

export interface JournalRowLine {
  group_key: string;
  entry_number: string;
  journal_type_display: string;
  description: string;
  entry_date: string;
  created_at: string;
  account_name: string;
  account_code?: string;
  side: "debit" | "credit";
  amount_base: number;
  amount_original: number;
  currency?: string;
}

export function toJournalLines(entry: JournalEntryDto): JournalRowLine[] {
  let journalTypeDisplay = entry.journal_type_display;

  if (
    entry.journal_type === "CashSalesJournal" ||
    entry.journal_type === "CreditSalesJournal"
  ) {
    journalTypeDisplay = "مبيعات نقدية";
  }
  if (entry.journal_type === "PurchaseReturnJournal") {
    journalTypeDisplay = "مرتجعات المشتريات";
  }
  if (entry.journal_type === "SalesReturnJournal") {
    journalTypeDisplay = "مرتجعات المبيعات";
  }
  if (entry.journal_type === "SupplierReceiptJournal") {
    journalTypeDisplay = "سند قبض من مورد";
  }
  if (entry.journal_type === "CustomerPaymentJournal") {
    journalTypeDisplay = "سند دفع لعميل";
  }

  if (entry.journal_type === "GeneralJournal") {
    const debits = entry.lines.filter((l) => parseFloat(l.debit || "0") > 0);
    const credits = entry.lines.filter((l) => parseFloat(l.credit || "0") > 0);
    if (debits.length === 1 && credits.length === 1) {
      const drLine = debits[0];
      const crLine = credits[0];
      if (
        (drLine.partner_id && !crLine.partner_id) ||
        crLine.account_code?.startsWith("332") ||
        crLine.account_name?.includes("خصوم مكتسبة")
      ) {
        journalTypeDisplay = "حسم مكتسب";
      } else if (
        (!drLine.partner_id && crLine.partner_id) ||
        drLine.account_code?.startsWith("47") ||
        drLine.account_name?.includes("خصوم ممنوحة")
      ) {
        journalTypeDisplay = "حسم ممنوح";
      }
    }
  }

  const lines: JournalRowLine[] = [];

  for (const l of entry.lines) {
    const d = parseFloat(l.debit || "0");
    const c = parseFloat(l.credit || "0");
    const rate = parseFloat(l.fx_rate || "1");

    const debitBase =
      l.debit_base !== undefined
        ? parseFloat(l.debit_base)
        : rate > 0
          ? d / rate
          : d;
    const creditBase =
      l.credit_base !== undefined
        ? parseFloat(l.credit_base)
        : rate > 0
          ? c / rate
          : c;

    const isOrig = isOriginalAmount(l.currency, l.fx_rate);

    if (d > 0) {
      lines.push({
        group_key: entry.id,
        entry_number: entry.entry_number,
        journal_type_display: journalTypeDisplay,
        description: entry.description,
        entry_date: entry.entry_date,
        created_at: entry.created_at,
        account_name: l.account_name || l.account_id,
        account_code: l.account_code,
        side: "debit",
        amount_base: debitBase,
        amount_original: isOrig ? d : 0,
        currency: isOrig ? l.currency : undefined,
      });
    }

    if (c > 0) {
      lines.push({
        group_key: entry.id,
        entry_number: entry.entry_number,
        journal_type_display: journalTypeDisplay,
        description: entry.description,
        entry_date: entry.entry_date,
        created_at: entry.created_at,
        account_name: l.account_name || l.account_id,
        account_code: l.account_code,
        side: "credit",
        amount_base: creditBase,
        amount_original: isOrig ? c : 0,
        currency: isOrig ? l.currency : undefined,
      });
    }
  }

  // Debits before credits within each group
  lines.sort((a, b) => {
    if (a.group_key !== b.group_key) return 0;
    if (a.side !== b.side) return a.side === "debit" ? -1 : 1;
    return 0;
  });

  return lines;
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
      totals.debitBase +=
        l.debit_base !== undefined
          ? parseFloat(l.debit_base)
          : rate > 0
            ? d / rate
            : d;
      totals.creditBase +=
        l.credit_base !== undefined
          ? parseFloat(l.credit_base)
          : rate > 0
            ? c / rate
            : c;
      if (isOriginalAmount(l.currency, l.fx_rate)) {
        totals.debitOriginal += d;
        totals.creditOriginal += c;
      }
    });
  });
  return totals;
}

export function aggregateTotals(rows: JournalRowLine[]) {
  const totals = {
    debitOriginal: 0,
    creditOriginal: 0,
    debitBase: 0,
    creditBase: 0,
  };
  rows.forEach((r) => {
    if (r.side === "debit") {
      totals.debitBase += r.amount_base;
      totals.debitOriginal += r.amount_original;
    } else {
      totals.creditBase += r.amount_base;
      totals.creditOriginal += r.amount_original;
    }
  });
  return totals;
}
