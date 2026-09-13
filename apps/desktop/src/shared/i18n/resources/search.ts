import type { AppLanguage, TranslationTree } from "@shared/types/i18n";

export const search: Record<AppLanguage, TranslationTree> = {
  ar: {
    placeholder: "ابحث في الصفحات والأوامر والنتائج...",
    recent: "الأخيرة",
    commands: "الأوامر",
    navigation: "التنقل",
    tabs: "التبويبات المفتوحة",
    noResults: "لا توجد نتائج مطابقة",
    hint: "استخدم الأسهم للتنقل و Enter للاختيار",
    groups: {
      results: "النتائج",
      pages: "الصفحات",
      actions: "الإجراءات",
    },
  },
  en: {
    placeholder: "Search pages, commands, and results...",
    recent: "Recent",
    commands: "Commands",
    navigation: "Navigation",
    tabs: "Open Tabs",
    noResults: "No matching results",
    hint: "Use arrows to navigate and Enter to open",
    groups: {
      results: "Results",
      pages: "Pages",
      actions: "Actions",
    },
  },
};