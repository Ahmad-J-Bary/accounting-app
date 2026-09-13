import type { AppLanguage, TranslationTree } from "@shared/types/i18n";

export const settings: Record<AppLanguage, TranslationTree> = {
  ar: {
    language: "اللغة",
    terminology: "المصطلحات",
    tabStyle: "أسلوب التبويبات",
    motion: "الحركة",
    reducedMotion: "تقليل الحركة",
  },
  en: {
    language: "Language",
    terminology: "Terminology",
    tabStyle: "Tab Style",
    motion: "Motion",
    reducedMotion: "Reduced Motion",
  },
};