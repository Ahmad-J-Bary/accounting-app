const ARABIC_RE = /[\u0600-\u06FF]/;

const ENGLISH_RULES: Array<{ match: RegExp; friendly: string }> = [
  {
    match: /integrity check failed|quick_check failed|integrity check/i,
    friendly: "فشل فحص سلامة قاعدة البيانات",
  },
  {
    match: /backup is not a readable sqlite database|not a database|file is not a database/i,
    friendly: "الملف ليس قاعدة بيانات سليمة",
  },
  {
    match: /failed to create snapshot|vacuum into|could not create snapshot/i,
    friendly: "تعذر إنشاء النسخة",
  },
  {
    match: /database is locked|is locked|couldn't acquire|busy/i,
    friendly: "قاعدة البيانات مشغولة — حاول مجددًا بعد لحظات",
  },
  {
    match: /unique constraint/i,
    friendly: "تعارض في البيانات (قيد فريد مكرر)",
  },
  {
    match: /foreign key/i,
    friendly: "انتهاك علاقات البيانات (Foreign Key)",
  },
  {
    match: /no such table/i,
    friendly: "جدول غير موجود في قاعدة البيانات",
  },
  {
    match: /failed to copy|copy restore file|cannot copy/i,
    friendly: "تعذر نسخ الملف إلى الوجهة المختارة",
  },
  {
    match: /failed to write restore marker/i,
    friendly: "تعذر حفظ حالة الاستعادة",
  },
  {
    match: /invalid backup file name|invalid path|المسار غير/i,
    friendly: "المسار أو اسم الملف غير صحيح",
  },
  {
    match: /permission|access denied|denied/i,
    friendly: "لا توجد صلاحية للوصول إلى الملف أو المجلد",
  },
  {
    match: /disk|space|no space/i,
    friendly: "مساحة التخزين غير كافية",
  },
];

const GENERIC_FRIENDLY = "حدث خطأ أثناء العملية — راجع التفاصيل";

export interface BackupError {
  /** Ready-to-show Arabic message (never a raw engine dump). */
  friendly: string;
  /** The raw message, only surfaced inside an expandable "تفاصيل الخطأ". */
  detail: string | null;
}

/**
 * localStorage key holding the last-seen restore status, so a one-shot
 * "تمت الاستعادة بنجاح" toast fires exactly once per transition. Cleared when
 * a new restore is staged (see InspectFileFlow) so repeated restores toast too.
 */
export const RESTORE_STATUS_SEEN_KEY = "erp_restore_status_seen";

/**
 * Translate a backend/engine error into a friendly Arabic message for normal
 * UI, keeping the raw text available for an expandable details view. Messages
 * that are already Arabic are passed through untouched.
 */
export function friendlyBackupError(raw: unknown): BackupError {
  const text = typeof raw === "string" ? raw.trim() : raw instanceof Error ? raw.message : String(raw);
  if (!text) {
    return { friendly: GENERIC_FRIENDLY, detail: null };
  }
  if (ARABIC_RE.test(text)) {
    return { friendly: text, detail: null };
  }
  for (const { match, friendly } of ENGLISH_RULES) {
    if (match.test(text)) {
      return { friendly, detail: text };
    }
  }
  return { friendly: GENERIC_FRIENDLY, detail: text };
}