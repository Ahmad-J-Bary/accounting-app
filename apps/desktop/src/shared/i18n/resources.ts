import type { AppLanguage, I18nNamespace, TranslationTree } from "@shared/types/i18n";

type NamespaceBundle = Record<I18nNamespace, TranslationTree>;

export const DEFAULT_LANGUAGE: AppLanguage = "ar";

export const LOCALE_BY_LANGUAGE: Record<AppLanguage, string> = {
  ar: "ar-SY",
  en: "en-US",
};

export const DIRECTION_BY_LANGUAGE: Record<AppLanguage, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export const I18N_RESOURCES: Record<AppLanguage, NamespaceBundle> = {
  ar: {
    common: {
      actions: {
        cancel: "إلغاء",
        close: "إغلاق",
        confirm: "تأكيد",
        save: "حفظ",
        open: "فتح",
        search: "بحث",
        newTab: "تبويب جديد",
      },
      states: {
        loading: "جاري التحميل...",
        noResults: "لا توجد نتائج",
        unavailable: "غير متاح",
      },
    },
    shell: {
      dashboard: "لوحة التحكم",
      globalSearch: "البحث الشامل",
      newTab: "تبويب جديد",
      tabs: {
        default: "افتراضي",
        browser: "مشابه للمتصفح",
        vscode: "مشابه لـ VS Code",
      },
      voice: "المساعد الصوتي",
      windows: "النوافذ",
    },
    search: {
      placeholder: "ابحث في الصفحات والأوامر والنتائج...",
      recent: "الأخيرة",
      commands: "الأوامر",
      navigation: "التنقل",
      tabs: "التبويبات المفتوحة",
      noResults: "لا توجد نتائج مطابقة",
      hint: "استخدم الأسهم للتنقل و Enter للاختيار",
    },
    commands: {
      openSearch: "فتح البحث",
      newDashboardTab: "فتح تبويب جديد",
      newSalesInvoice: "فاتورة مبيعات جديدة",
      newPurchaseInvoice: "فاتورة مشتريات جديدة",
      newJournalEntry: "قيد يومية جديد",
      newOpeningBalance: "فاتورة أول المدة جديدة",
      openSettings: "فتح الإعدادات",
    },
    voice: {
      title: "المساعد الصوتي",
      idle: "جاهز للاستماع",
      recording: "جاري الاستماع...",
      transcribing: "جاري تحويل الصوت إلى نص...",
      analyzing: "جاري فهم الطلب...",
      ambiguous: "يوجد أكثر من احتمال",
      confirmation: "تأكيد التنفيذ",
      executing: "جاري التنفيذ...",
      success: "تم التنفيذ بنجاح",
      error: "تعذر تنفيذ الطلب",
    },
    settings: {
      language: "اللغة",
      terminology: "المصطلحات",
      tabStyle: "أسلوب التبويبات",
      motion: "الحركة",
      reducedMotion: "تقليل الحركة",
    },
  },
  en: {
    common: {
      actions: {
        cancel: "Cancel",
        close: "Close",
        confirm: "Confirm",
        save: "Save",
        open: "Open",
        search: "Search",
        newTab: "New Tab",
      },
      states: {
        loading: "Loading...",
        noResults: "No results",
        unavailable: "Unavailable",
      },
    },
    shell: {
      dashboard: "Dashboard",
      globalSearch: "Global Search",
      newTab: "New Tab",
      tabs: {
        default: "Default",
        browser: "Browser",
        vscode: "VS Code",
      },
      voice: "Voice Assistant",
      windows: "Windows",
    },
    search: {
      placeholder: "Search pages, commands, and results...",
      recent: "Recent",
      commands: "Commands",
      navigation: "Navigation",
      tabs: "Open Tabs",
      noResults: "No matching results",
      hint: "Use arrows to navigate and Enter to open",
    },
    commands: {
      openSearch: "Open Search",
      newDashboardTab: "Open New Tab",
      newSalesInvoice: "New Sales Invoice",
      newPurchaseInvoice: "New Purchase Invoice",
      newJournalEntry: "New Journal Entry",
      newOpeningBalance: "New Opening Balance",
      openSettings: "Open Settings",
    },
    voice: {
      title: "Voice Assistant",
      idle: "Ready to listen",
      recording: "Listening...",
      transcribing: "Transcribing...",
      analyzing: "Understanding request...",
      ambiguous: "More than one interpretation found",
      confirmation: "Confirm action",
      executing: "Executing...",
      success: "Done successfully",
      error: "Could not complete the request",
    },
    settings: {
      language: "Language",
      terminology: "Terminology",
      tabStyle: "Tab Style",
      motion: "Motion",
      reducedMotion: "Reduced Motion",
    },
  },
};

export function getNestedTranslation(tree: TranslationTree, key: string): string | undefined {
  const parts = key.split(".");
  let current: string | TranslationTree | undefined = tree;
  for (const part of parts) {
    if (!current || typeof current === "string") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}
