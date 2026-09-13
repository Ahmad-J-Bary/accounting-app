import type { AppLanguage, TranslationTree } from "@shared/types/i18n";

export const auth: Record<AppLanguage, TranslationTree> = {
  ar: {
    loading: "جاري التحميل...",
    callback: {
      processing: "جارٍ معالجة المصادقة...",
    },
    error: {
      title: "خطأ في المصادقة",
      defaultMessage: "عذرًا، معلومات المصادقة الخاصة بك غير صالحة أو منتهية الصلاحية",
      countdownPrefix: "سيتم العودة تلقائيًا إلى الصفحة الرئيسية خلال",
      countdownSuffix: "ثانية",
      redirecting: "جارٍ إعادة التوجيه...",
      returnHome: "العودة إلى الرئيسية",
    },
  },
  en: {
    loading: "Loading...",
    callback: {
      processing: "Processing authentication...",
    },
    error: {
      title: "Authentication Error",
      defaultMessage: "Sorry, your authentication information is invalid or has expired",
      countdownPrefix: "Will automatically return to the home page in",
      countdownSuffix: "seconds",
      redirecting: "Redirecting...",
      returnHome: "Return to Home",
    },
  },
};