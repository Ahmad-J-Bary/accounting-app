export type StatusTone =
  | "slate"
  | "amber"
  | "blue"
  | "green"
  | "orange"
  | "emerald"
  | "red"
  | "rose";

export const STATUS_LABEL: Record<string, string> = {
  Draft: "مسودة",
  Saved: "محفوظ",
  Validated: "تم التحقق",
  Approved: "معتمد",
  Posted: "مرحّل",
  Locked: "مقفول",
  Cancelled: "ملغي",
  PartiallyPaid: "مدفوع جزئياً",
  FullyPaid: "مدفوع بالكامل",
  InProgress: "جاري التنفيذ",
  Completed: "مكتمل",
  Open: "مفتوحة",
  Closing: "جارٍ الإغلاق",
  Reopened: "مُعاد فتحها",
  Closed: "مغلقة",
};

export const STATUS_TONE: Record<string, StatusTone> = {
  Draft: "amber",
  Saved: "blue",
  Validated: "blue",
  Approved: "emerald",
  Posted: "green",
  Locked: "slate",
  Cancelled: "red",
  PartiallyPaid: "orange",
  FullyPaid: "emerald",
  InProgress: "blue",
  Completed: "green",
  Open: "green",
  Closing: "amber",
  Reopened: "blue",
  Closed: "slate",
};