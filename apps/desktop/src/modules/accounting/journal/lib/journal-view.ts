import type { JournalEntryDto, JournalLineDto } from "@erp/shared-types";
import { isOfficialJournalEntry } from "@modules/reports/lib/report-policies";

const isOriginalAmount = (currencyCode?: string, fxRate?: string) => {
  const rate = parseFloat(fxRate || "1");
  return Boolean(currencyCode) && Math.abs(rate - 1) > Number.EPSILON;
};

/** نوع فرعي لعنوان تلخيص القيد (عرض فقط). يرتكز على الغرض أولاً ثم الكود/الاسم. */
function classifyAssetSubType(line: JournalLineDto): "أبنية وأراضي" | "معدات وتجهيزات" | "أثاث ومفروشات" | null {
  const accName = line.account_name || "";
  const accCode = line.account_code || "";
  if (
    accName.includes("أبنية") ||
    accName.includes("أراضي") ||
    accName.includes("المباني") ||
    accName.includes("الأراضي")
  ) {
    return "أبنية وأراضي";
  }
  if (
    accName.includes("معدات") ||
    accName.includes("تجهيزات") ||
    accName.includes("الآلات") ||
    accName.includes("المعدات")
  ) {
    return "معدات وتجهيزات";
  }
  if (
    accName.includes("أثاث") ||
    accName.includes("مفروشات") ||
    accName.includes("المفروشات")
  ) {
    return "أثاث ومفروشات";
  }
  if (accCode.startsWith("1101") || accCode.startsWith("111")) {
    return "أبنية وأراضي";
  }
  if (accCode.startsWith("1102") || accCode.startsWith("112")) {
    return "معدات وتجهيزات";
  }
  if (accCode.startsWith("1103") || accCode.startsWith("113")) {
    return "أثاث ومفروشات";
  }
  return null;
}

/**
 * Arabic display label for a journal ENTRY (display-only derivation). The
 * source of truth stays the `journal_type` variant; the reversal relationship
 * is a state flag, never a type — a contra journal (`reversal_of_entry_id`
 * set) or a Reversed original is badged (عكس / معكوس) AND suffixed with
 * " — معكوس" so the label itself reads e.g. "رصيد افتتاحي — معكوس". Draft /
 * Cancelled statuses are surfaced separately as badges (مسودة / ملغي). Shared
 * by both the two-line and one-line report shapes so the derivation cannot
 * drift between them.
 */
export function deriveJournalTypeDisplay(entry: JournalEntryDto): string {
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
    const desc = entry.description || "";
    const isDepreciation = desc.includes("إهلاك سنوي") || desc.includes("إهلاك");
    const isOpening = desc.includes("إضافة أصل سابق") || desc.includes("أول المدة");
    const isPurchase = desc.includes("شراء أصل ثابت") || desc.includes("اثبات شراء");

    if (isDepreciation || isOpening || isPurchase) {
      let assetType: string = "أصول ثابتة";
      for (const line of entry.lines) {
        if (line.account_purpose === "fixed_asset") continue;
        const subtype = classifyAssetSubType(line);
        if (subtype) {
          assetType = subtype;
          break;
        }
      }

      if (isDepreciation) {
        journalTypeDisplay = "إهلاك سنوي";
      } else if (isOpening) {
        journalTypeDisplay = `رصيد افتتاحي للأصول الثابتة / ${assetType}`;
      } else if (isPurchase) {
        journalTypeDisplay = `شراء أصل ثابت / ${assetType}`;
      }
    } else {
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
  }

  const isReversalParty = Boolean(entry.reversal_of_entry_id) || entry.status === "Reversed";
  return isReversalParty ? `${journalTypeDisplay} — معكوس` : journalTypeDisplay;
}

/**
 * Lookup context (built ONCE over the full journal fetch, so a reversal pair
 * split by a date filter still resolves its counterpart): entry id → its own
 * number, and reversed original id → the number of the contra that reversed it.
 */
export interface ReversalContext {
  entryNumberById: ReadonlyMap<string, string>;
  reversedById: ReadonlyMap<string, string>;
}

/**
 * The counterpart entry number of a reversal pair, derived from state only
 * (never stored): a contra journal resolves its Reversed original's number,
 * a Reversed original resolves its Posted contra's number.
 */
export function reversalEntryNumber(entry: JournalEntryDto, ctx?: ReversalContext): string | undefined {
  if (!ctx) return undefined;
  if (entry.reversal_of_entry_id) {
    return ctx.entryNumberById.get(entry.reversal_of_entry_id);
  }
  if (entry.status === "Reversed") {
    return ctx.reversedById.get(entry.id);
  }
  return undefined;
}

export interface JournalRowLine {
  group_key: string;
  id: string;
  entry_number: string;
  journal_type_display: string;
  status?: string;
  /** True when this entry is a reversal contra of another entry (display-only
   * derivation of `reversal_of_entry_id`). A reversal is a relationship, not a
   * type — so the semantic type above is unchanged, only badged differently. */
  is_contra?: boolean;
  /** Counterpart entry number of a reversal pair (display-only derivation via
   * `ReversalContext`): the original's number on a contra, the contra's number
   * on a Reversed original. */
  reversal_entry_number?: string;
  description: string;
  entry_date: string;
  created_at: string;
  account_name: string;
  account_code?: string;
  /** Entry-level sort anchor for the account column: every line of one journal
   * shares the same value, so a multi-line entry stays adjacent (one header)
   * even when the register is sorted by account. */
  groupSortAccount: string;
  side: "debit" | "credit";
  amount_base: number;
  amount_original: number;
  currency?: string;
}

export function toJournalLines(entry: JournalEntryDto, ctx?: ReversalContext): JournalRowLine[] {
  const journalTypeDisplay = deriveJournalTypeDisplay(entry);
  const reversalNumber = reversalEntryNumber(entry, ctx);

  const lines: JournalRowLine[] = [];
  const groupSortAccount =
    entry.lines[0]?.account_name || entry.lines[0]?.account_id || "";

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
        id: entry.id,
        entry_number: entry.entry_number,
        journal_type_display: journalTypeDisplay,
        status: entry.status,
        is_contra: Boolean(entry.reversal_of_entry_id),
        reversal_entry_number: reversalNumber,
        description: entry.description,
        entry_date: entry.entry_date,
        created_at: entry.created_at,
        account_name: l.account_name || l.account_id,
        account_code: l.account_code,
        groupSortAccount,
        side: "debit",
        amount_base: debitBase,
        amount_original: isOrig ? d : 0,
        currency: isOrig ? l.currency : undefined,
      });
    }

    if (c > 0) {
      lines.push({
        group_key: entry.id,
        id: entry.id,
        entry_number: entry.entry_number,
        journal_type_display: journalTypeDisplay,
        status: entry.status,
        is_contra: Boolean(entry.reversal_of_entry_id),
        reversal_entry_number: reversalNumber,
        description: entry.description,
        entry_date: entry.entry_date,
        created_at: entry.created_at,
        account_name: l.account_name || l.account_id,
        account_code: l.account_code,
        groupSortAccount,
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

export interface JournalSingleLineRow {
  group_key: string;
  id: string;
  entry_number: string;
  journal_type_display: string;
  status?: string;
  /** True when this entry is a reversal contra (see JournalRowLine.is_contra). */
  is_contra?: boolean;
  /** Counterpart entry number of a reversal pair (see JournalRowLine.reversal_entry_number). */
  reversal_entry_number?: string;
  description: string;
  entry_date: string;
  created_at: string;
  debit_account_names: string;
  debit_account_codes: string[];
  credit_account_names: string;
  credit_account_codes: string[];
  debit_amount_base: number;
  credit_amount_base: number;
  debit_amount_original: number;
  credit_amount_original: number;
  debit_currency?: string;
  credit_currency?: string;
}

export function toJournalLinesSingleLine(entry: JournalEntryDto, ctx?: ReversalContext): JournalSingleLineRow[] {
  const journalTypeDisplay = deriveJournalTypeDisplay(entry);
  const reversalNumber = reversalEntryNumber(entry, ctx);

  const debits = entry.lines.filter((l) => parseFloat(l.debit || "0") > 0);
  const credits = entry.lines.filter((l) => parseFloat(l.credit || "0") > 0);

  let totalDebitBase = 0;
  let totalCreditBase = 0;
  let totalDebitOriginal = 0;
  let totalCreditOriginal = 0;
  let debitCurrency: string | undefined;
  let creditCurrency: string | undefined;

  const debitAccountNames: string[] = [];
  const debitAccountCodes: string[] = [];
  const creditAccountNames: string[] = [];
  const creditAccountCodes: string[] = [];

  for (const l of debits) {
    const d = parseFloat(l.debit || "0");
    const rate = parseFloat(l.fx_rate || "1");
    const debitBase = l.debit_base !== undefined
      ? parseFloat(l.debit_base)
      : rate > 0 ? d / rate : d;
    
    totalDebitBase += debitBase;
    if (isOriginalAmount(l.currency, l.fx_rate)) {
      totalDebitOriginal += d;
      debitCurrency = l.currency;
    }
    debitAccountNames.push(l.account_name || l.account_id);
    debitAccountCodes.push(l.account_code || "");
  }

  for (const l of credits) {
    const c = parseFloat(l.credit || "0");
    const rate = parseFloat(l.fx_rate || "1");
    const creditBase = l.credit_base !== undefined
      ? parseFloat(l.credit_base)
      : rate > 0 ? c / rate : c;
    
    totalCreditBase += creditBase;
    if (isOriginalAmount(l.currency, l.fx_rate)) {
      totalCreditOriginal += c;
      creditCurrency = l.currency;
    }
    creditAccountNames.push(l.account_name || l.account_id);
    creditAccountCodes.push(l.account_code || "");
  }

  return [{
    group_key: entry.id,
    id: entry.id,
    entry_number: entry.entry_number,
    journal_type_display: journalTypeDisplay,
    status: entry.status,
    is_contra: Boolean(entry.reversal_of_entry_id),
    reversal_entry_number: reversalNumber,
    description: entry.description,
    entry_date: entry.entry_date,
    created_at: entry.created_at,
    debit_account_names: debitAccountNames.join("، "),
    debit_account_codes: debitAccountCodes,
    credit_account_names: creditAccountNames.join("، "),
    credit_account_codes: creditAccountCodes,
    debit_amount_base: totalDebitBase,
    credit_amount_base: totalCreditBase,
    debit_amount_original: totalDebitOriginal,
    credit_amount_original: totalCreditOriginal,
    debit_currency: debitCurrency,
    credit_currency: creditCurrency,
  }];
}

export type JournalTwoLineSortField = "entry_number" | "created_at" | "journal_type" | "account";
export type SortDirection = "asc" | "desc";

/**
 * Two-line journal-register comparator. The `account` field compares the
 * ENTRY-level anchor (`groupSortAccount`) shared by every line of a journal,
 * never the per-line account — so a multi-line entry (e.g. the residual
 * reclassification: Dr 53 / Cr 52) always sorts as one adjacent group under
 * one header, regardless of the selected column.
 */
export function journalTwoLineCompare(
  a: JournalRowLine,
  b: JournalRowLine,
  field: JournalTwoLineSortField,
  direction: SortDirection,
): number {
  let comparison = 0;
  switch (field) {
    case "entry_number":
      comparison = (parseInt(a.entry_number || "0", 10) || 0) - (parseInt(b.entry_number || "0", 10) || 0);
      break;
    case "created_at":
      comparison = new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
      break;
    case "journal_type":
      comparison = (a.journal_type_display || "").localeCompare(b.journal_type_display || "", "ar");
      break;
    case "account":
      comparison = (a.groupSortAccount || "").localeCompare(b.groupSortAccount || "", "ar");
      break;
  }
  return direction === "asc" ? comparison : -comparison;
}

export type JournalEntryReportClass = "operational" | "audit";

/**
 * Reporting policy: a journal is OPERATIONAL only when it is a Posted
 * entry with no reversal relationship AND an accounting effect (the official
 * GENERAL JOURNAL policy). Reversed originals, their Posted contra journals,
 * Draft / Cancelled entries and zero-effect postings are never operational —
 * they belong to the separated audit archive so Original / Reversal / Final
 * Opening can never appear as three normal transactions.
 *
 * Delegates to the shared explicit policy (`report-policies`) so the journal
 * view and the financial statements can never drift apart on the published
 * semantics.
 */
export function classifyEntryForReport(entry: JournalEntryDto): JournalEntryReportClass {
  return isOfficialJournalEntry(entry) ? "operational" : "audit";
}

export function partitionJournalEntries(entries: JournalEntryDto[]): {
  operational: JournalEntryDto[];
  audit: JournalEntryDto[];
} {
  const operational: JournalEntryDto[] = [];
  const audit: JournalEntryDto[] = [];
  for (const entry of entries) {
    (classifyEntryForReport(entry) === "operational" ? operational : audit).push(entry);
  }
  return { operational, audit };
}

/**
 * Audit-archive ordering key: a reversal is a relationship — the contra
 * journal carries `reversal_of_entry_id` pointing at the Reversed original.
 * Grouping by this key keeps each pair adjacent in the audit section.
 */
export function auditGroupKey(entry: JournalEntryDto): string {
  return entry.reversal_of_entry_id || entry.id;
}
