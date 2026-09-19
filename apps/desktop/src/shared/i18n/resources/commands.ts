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
    closeActiveTab: "إغلاق التبويب النشط",
    nextTab: "الانتقال إلى التبويب التالي",
    previousTab: "الانتقال إلى التبويب السابق",
    reopenLastTab: "إعادة فتح آخر تبويب مغلق",
  },
  en: {
    openSearch: "Open Search",
    newDashboardTab: "Open New Tab",
    newSalesInvoice: "New Sales Invoice",
    newPurchaseInvoice: "New Purchase Invoice",
    newJournalEntry: "New Journal Entry",
    newOpeningBalance: "New Opening Balance",
    openSettings: "Open Settings",
    closeActiveTab: "Close Active Tab",
    nextTab: "Next Tab",
    previousTab: "Previous Tab",
    reopenLastTab: "Reopen Last Closed Tab",
  },
};
