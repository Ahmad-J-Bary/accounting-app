import type { AppLanguage, TranslationTree } from "@shared/types/i18n";

export const commands: Record<AppLanguage, TranslationTree> = {
  ar: {
    openSearch: "فتح البحث",
    newDashboardTab: "فتح تبويب جديد",
    newSalesInvoice: "فاتورة مبيعات جديدة",
    newPurchaseInvoice: "فاتورة مشتريات جديدة",
    newJournalEntry: "قيد يومية جديد",
    newOpeningBalance: "فاتورة أول المدة جديدة",
    openSettings: "فتح الإعدادات",
  },
  en: {
    openSearch: "Open Search",
    newDashboardTab: "Open New Tab",
    newSalesInvoice: "New Sales Invoice",
    newPurchaseInvoice: "New Purchase Invoice",
    newJournalEntry: "New Journal Entry",
    newOpeningBalance: "New Opening Balance",
    openSettings: "Open Settings",
  },
};