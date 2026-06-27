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
  { value: "CashJournal", label: "يومية الصندوق" },
  { value: "CashSalesJournal", label: "يومية المبيعات النقدية" },
  { value: "CreditSalesJournal", label: "يومية المبيعات الآجلة" },
  { value: "SalesReturnJournal", label: "يومية مرتجعات المبيعات" },
  { value: "PurchaseJournal", label: "يومية المشتريات" },
  { value: "PurchaseCostsJournal", label: "يومية التكاليف الإضافية للمشتريات" },
  { value: "PurchaseReturnJournal", label: "يومية مرتجعات المشتريات" },
];

/** Full mapping of every journal type to its Arabic display label (matches Rust Display impl) */
export const JOURNAL_TYPE_LABELS: Record<string, string> = {
  GeneralJournal: "اليومية العامة",
  CashJournal: "يومية الصندوق",
  CashSalesJournal: "يومية المبيعات النقدية",
  CreditSalesJournal: "يومية المبيعات الآجلة",
  PurchaseJournal: "مشتريات",
  PurchaseCostsJournal: "تكاليف إضافية للمشتريات",
  CashReceipt: "سند قبض",
  CashPayment: "سند دفع",
  SupplierReceiptJournal: "سند قبض من مورد",
  CustomerPaymentJournal: "سند دفع لعميل",
  ExpenseVoucher: "سند مصاريف",
  DrawingsVoucher: "سند مسحوبات",
  CashOpeningBalance: "رصيد افتتاحي للخزينة",
  AccountOpeningBalance: "رصيد افتتاحي لحساب",
  MaterialOpeningBalance: "رصيد افتتاحي للمواد / أول المدة",
  SalesReturnJournal: "مرتجع مبيعات",
  PurchaseReturnJournal: "مرتجع مشتريات",
  DamagedJournal: "خسائر المواد التالفة",
  AdjustmentJournal: "تسوية جرد",
};

export const JOURNAL_REPORT_TYPES: JournalReportTypeOption[] = [
  { value: "GeneralJournal", label: "حركة اليومية العامة", desc: "سجل كامل للقيود اليومية" },
  { value: "CashJournal", label: "يومية الصندوق / الخزينة", desc: "كل القيود التي يظهر فيها حساب الصندوق" },
  { value: "CashSalesJournal", label: "يومية المبيعات النقدية", desc: "قيود المبيعات النقدية" },
  { value: "CreditSalesJournal", label: "يومية المبيعات الآجلة", desc: "قيود المبيعات الآجلة والذمم" },
  { value: "PurchaseJournal", label: "مشتريات", desc: "قيود المشتريات النقدية والآجلة" },
  { value: "PurchaseCostsJournal", label: "تكاليف إضافية للمشتريات", desc: "قيود التكاليف الإضافية للمشتريات" },
  { value: "SalesReturnJournal", label: "مرتجع مبيعات", desc: "مرتجعات المبيعات" },
  { value: "PurchaseReturnJournal", label: "مرتجع مشتريات", desc: "مرتجعات المشتريات" },
];

// Unified column order for ALL journal types:
// رقم القيد, نوع الحركة, مدين (أساسي), مدين (أصلي), دائن (أساسي), دائن (أصلي), البيان, الدائن/المصدر, المدين/الوجهة, التاريخ
export const JOURNAL_COLUMNS = [
  "entry_number",
  "journal_type",
  "total_debit_base",
  "total_debit_original",
  "total_credit_base",
  "total_credit_original",
  "description",
  "credit_account",
  "debit_account",
  "entry_date",
];

export function getJournalColumnsByType(): string[] {
  return JOURNAL_COLUMNS;
}
