import type { JournalType } from "@erp/shared-types";

export interface JournalTypeOption {
  value: JournalType;
  label: string;
}

export interface JournalReportTypeOption extends JournalTypeOption {
  desc: string;
}

export const JOURNAL_TYPES: JournalTypeOption[] = [
  { value: "GeneralJournal", label: "اليومية العامة" },
  { value: "CashOpeningBalance", label: "رصيد افتتاحي للخزينة" },
  { value: "AccountOpeningBalance", label: "رصيد افتتاحي لحساب" },
  { value: "MaterialOpeningBalance", label: "رصيد افتتاحي للمواد" },
  { value: "CashJournal", label: "يومية الصندوق" },
  { value: "CashSalesJournal", label: "يومية المبيعات النقدية" },
  { value: "CreditSalesJournal", label: "يومية المبيعات الآجلة" },
  { value: "CashReceipt", label: "سندات القبض" },
  { value: "CashPayment", label: "سندات الصرف" },
  { value: "ExpenseVoucher", label: "سندات المصاريف" },
  { value: "DrawingsVoucher", label: "سندات المسحوبات" },
  { value: "PurchaseJournal", label: "يومية المشتريات" },
  { value: "PurchaseCostsJournal", label: "يومية تكاليف الشراء" },
];

export const JOURNAL_REPORT_TYPES: JournalReportTypeOption[] = [
  { value: "GeneralJournal", label: "حركة اليومية العامة", desc: "سجل كامل للقيود اليومية" },
  { value: "CashJournal", label: "يومية الصندوق / الخزينة", desc: "كل القيود التي يظهر فيها حساب الصندوق" },
  { value: "CashSalesJournal", label: "يومية المبيعات النقدية", desc: "قيود المبيعات النقدية" },
  { value: "CreditSalesJournal", label: "يومية المبيعات الآجلة", desc: "قيود المبيعات الآجلة والذمم" },
  { value: "PurchaseJournal", label: "يومية المشتريات", desc: "قيود المشتريات النقدية والآجلة" },
  { value: "PurchaseCostsJournal", label: "يومية التكاليف الإضافية", desc: "قيود التكاليف الإضافية للمشتريات" },
  { value: "CashReceipt", label: "سندات القبض", desc: "قيود سندات القبض من العملاء" },
  { value: "CashPayment", label: "سندات الصرف", desc: "قيود سندات الصرف للموردين" },
  { value: "ExpenseVoucher", label: "سندات المصاريف", desc: "قيود سندات المصاريف العامة" },
  { value: "DrawingsVoucher", label: "سندات المسحوبات", desc: "قيود سندات المسحوبات" },
];

export function getJournalColumnsByType(journalType?: JournalType): string[] {
  switch (journalType) {
    case "CashJournal":
      return [
        "entry_date",
        "entry_number",
        "journal_type",
        "description",
        "debit_account",
        "credit_account",
        "total_debit_syp",
        "total_credit_syp",
      ];
    case "CashSalesJournal":
    case "CreditSalesJournal":
      return [
        "entry_date",
        "entry_number",
        "journal_type",
        "description",
        "debit_account",
        "credit_account",
        "total_debit_usd",
        "total_credit_usd",
        "total_debit_syp",
        "total_credit_syp",
      ];
    case "PurchaseJournal":
    case "PurchaseCostsJournal":
      return [
        "entry_date",
        "entry_number",
        "journal_type",
        "description",
        "debit_account",
        "credit_account",
        "total_debit_syp",
        "total_credit_syp",
      ];
    case "CashReceipt":
    case "CashPayment":
    case "ExpenseVoucher":
    case "DrawingsVoucher":
      return [
        "entry_date",
        "entry_number",
        "journal_type",
        "description",
        "debit_account",
        "credit_account",
        "total_debit_syp",
        "total_credit_syp",
      ];
    case "MaterialOpeningBalance":
      return [
        "entry_date",
        "entry_number",
        "journal_type",
        "description",
        "debit_account",
        "credit_account",
        "total_debit_syp",
        "total_credit_syp",
      ];
    case "GeneralJournal":
    default:
      return [
        "entry_date",
        "entry_number",
        "journal_type",
        "description",
        "debit_account",
        "credit_account",
        "total_debit_usd",
        "total_credit_usd",
        "total_debit_syp",
        "total_credit_syp",
      ];
  }
}

