import type { JournalType, JournalLineDto, CreateJournalEntryRequest } from "@erp/shared-types";
import type { JournalTypeOption } from "./journal-config";

export interface JournalLineDraft {
  key: string;
  account_id: string;
  side: "debit" | "credit";
  amount: string;
  currency: string;
  fx_rate: string;
  description: string;
  partner_id?: string;
}

let _lineCounter = 0;

export function createEmptyLine(baseCurrency = "SYP"): JournalLineDraft {
  _lineCounter += 1;
  return {
    key: `jl_${Date.now()}_${_lineCounter}`,
    account_id: "",
    side: "debit",
    amount: "",
    currency: baseCurrency,
    fx_rate: "1",
    description: "",
  };
}

export interface JournalEntryValidation {
  isValid: boolean;
  errors: string[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

/** Minimal translate signature accepted by the validation helpers. */
export type TranslateFn = (
  key: string,
  options?: {
    namespace?: string;
    fallback?: string;
    vars?: Record<string, string | number>;
    count?: number;
  },
) => string;

export function validateJournalEntry(
  journalType: JournalType | null,
  entryDate: string,
  description: string,
  lines: JournalLineDraft[],
  t?: TranslateFn,
): JournalEntryValidation {
  const errors: string[] = [];

  if (!journalType) {
    errors.push(t?.("journal.validation.typeRequired", { namespace: "accounting", fallback: "اختر نوع اليومية" }) ?? "اختر نوع اليومية");
  }

  if (!entryDate.trim()) {
    errors.push(t?.("journal.validation.dateRequired", { namespace: "accounting", fallback: "تاريخ القيد مطلوب" }) ?? "تاريخ القيد مطلوب");
  }

  if (!description.trim()) {
    errors.push(t?.("journal.validation.descriptionRequired", { namespace: "accounting", fallback: "وصف القيد مطلوب" }) ?? "وصف القيد مطلوب");
  }

  if (lines.length === 0) {
    errors.push(t?.("journal.validation.linesRequired", { namespace: "accounting", fallback: "يجب إضافة سطر واحد على الأقل" }) ?? "يجب إضافة سطر واحد على الأقل");
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const label = t?.("journal.validation.lineLabel", { namespace: "accounting", vars: { index: String(i + 1) }, fallback: `السطر ${i + 1}` }) ?? `السطر ${i + 1}`;

    if (!line.account_id) {
      errors.push(t?.("journal.validation.lineAccountRequired", { namespace: "accounting", vars: { line: label }, fallback: `${label}: اختر حساباً` }) ?? `${label}: اختر حساباً`);
    }

    const amount = parseFloat(line.amount);
    if (!line.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      errors.push(t?.("journal.validation.lineAmountInvalid", { namespace: "accounting", vars: { line: label }, fallback: `${label}: أدخل مبلغاً صحيحاً أكبر من صفر` }) ?? `${label}: أدخل مبلغاً صحيحاً أكبر من صفر`);
    }
  }

  const totalDebit = lines.reduce(
    (sum, l) => (l.side === "debit" ? sum + (parseFloat(l.amount) || 0) : sum),
    0,
  );
  const totalCredit = lines.reduce(
    (sum, l) => (l.side === "credit" ? sum + (parseFloat(l.amount) || 0) : sum),
    0,
  );

  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.001;

  if (lines.length > 0 && !isBalanced) {
    errors.push(t?.("journal.validation.unbalanced", { namespace: "accounting", fallback: "القيد غير متوازن — إجمالي المدين يجب أن يساوي إجمالي الدائن" }) ?? "القيد غير متوازن — إجمالي المدين يجب أن يساوي إجمالي الدائن");
  }

  return {
    isValid: errors.length === 0,
    errors,
    totalDebit,
    totalCredit,
    isBalanced,
  };
}

export function toCreateRequestLines(
  lines: JournalLineDraft[],
): JournalLineDto[] {
  return lines.map((l) => ({
    account_id: l.account_id,
    currency: l.currency,
    fx_rate: l.fx_rate,
    debit: l.side === "debit" ? l.amount : "0",
    credit: l.side === "credit" ? l.amount : "0",
    description: l.description,
    partner_id: l.partner_id,
  }));
}

export function buildCreateRequest(
  journalType: JournalType,
  entryDate: string,
  description: string,
  lines: JournalLineDraft[],
): CreateJournalEntryRequest {
  return {
    entry_number: "",
    journal_type: journalType,
    lines: toCreateRequestLines(lines),
    entry_date: entryDate,
    description: description.trim(),
  };
}

export const MANUAL_JOURNAL_TYPES: JournalTypeOption[] = [
  { value: "GeneralJournal", label: "اليومية العامة" },
  { value: "AdjustmentJournal", label: "تسوية جرد" },
  { value: "CapitalContribution", label: "مساهمة رأس مال" },
];
