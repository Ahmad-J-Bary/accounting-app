import type { AppLanguage, TranslationTree } from "@shared/types/i18n";

export const errors: Record<AppLanguage, TranslationTree> = {
  ar: {
    boundary: {
      pageCrash: "حدث خطأ في هذه الصفحة",
      unexpected: "حدث خطأ غير متوقع",
    },
  },
  en: {
    boundary: {
      pageCrash: "This page ran into an error",
      unexpected: "An unexpected error occurred",
    },
  },
};
