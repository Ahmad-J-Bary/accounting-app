import type { AppLanguage, TranslationTree } from "@shared/types/i18n";

export const voice: Record<AppLanguage, TranslationTree> = {
  ar: {
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
  en: {
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
};