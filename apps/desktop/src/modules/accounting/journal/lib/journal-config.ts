import type { JournalType } from "@erp/shared-types";

export interface JournalTypeOption {
  value: JournalType;
  label: string;
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
  CashOpeningBalance: "رصيد افتتاحي",
  AccountOpeningBalance: "رصيد افتتاحي",
  MaterialOpeningBalance: "رصيد افتتاحي للمواد / أول المدة",
  SalesReturnJournal: "مرتجع مبيعات",
  PurchaseReturnJournal: "مرتجع مشتريات",
  DamagedJournal: "خسائر المواد التالفة",
  AdjustmentJournal: "تسوية جرد",
  DiscountEarnedJournal: "حسم مكتسب",
  DiscountGrantedJournal: "حسم ممنوح",
  CapitalContribution: "مساهمة رأس مال",
  ProfitDistribution: "توزيع أرباح",
  OpeningBalanceReversal: "عكس ترحيل رصيد الافتتاح",
};

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
