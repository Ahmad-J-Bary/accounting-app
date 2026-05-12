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
  // Unified order for all types as requested by user:
  // رقم القيد, نوع الحركة, مدين $, مدين ل.س, دائن $, دائن ل.س, البيان, الدائن/المصدر, المدين/الوجهة, التاريخ
  
  const baseColumns = [
    "entry_number",
    "journal_type",
    "total_debit_usd",
    "total_debit_syp",
    "total_credit_usd",
    "total_credit_syp",
    "description",
    "credit_account",
    "debit_account",
    "entry_date",
  ];

  switch (journalType) {
    case "CashJournal":
    case "PurchaseJournal":
    case "PurchaseCostsJournal":
    case "CashReceipt":
    case "CashPayment":
    case "ExpenseVoucher":
    case "DrawingsVoucher":
    case "MaterialOpeningBalance":
      // For types that usually don't show USD in their specific reports, 
      // but user requested a unified format, we keep the order but maybe filter?
      // Actually the user said "متماثلين في القالب ونفس عناصر الجدول".
      // So I'll return the same for all.
      return baseColumns;
    case "CashSalesJournal":
    case "CreditSalesJournal":
    case "GeneralJournal":
    default:
      return baseColumns;
  }
}
