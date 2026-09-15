import type { AppLanguage, TranslationTree } from "@shared/types/i18n";

export const audit: Record<AppLanguage, TranslationTree> = {
  ar: {
    columns: {
      datetime: "التاريخ والوقت",
      datetimeLabel: "تاريخ ووقت العملية",
      user: "المستخدم",
      userLabel: "اسم المستخدم",
      action: "العملية",
      actionLabel: "نوع العملية",
      entityType: "نوع الكيان",
      entityTypeLabel: "نوع الكيان المتأثر",
      entityId: "معرف الكيان",
      entityIdLabel: "المعرف الفريد للكيان",
      ipAddress: "IP Address",
      ipAddressLabel: "عنوان IP",
    },
    searchPlaceholder: "بحث بالمستخدم، العملية، الكيان...",
    emptyMessage: "لا توجد سجلات مراقبة حالياً",
  },
  en: {
    columns: {
      datetime: "Date & Time",
      datetimeLabel: "Operation date & time",
      user: "User",
      userLabel: "Username",
      action: "Action",
      actionLabel: "Operation type",
      entityType: "Entity Type",
      entityTypeLabel: "Affected entity type",
      entityId: "Entity ID",
      entityIdLabel: "Unique entity identifier",
      ipAddress: "IP Address",
      ipAddressLabel: "IP address",
    },
    searchPlaceholder: "Search by user, action, entity...",
    emptyMessage: "No audit logs yet",
  },
};
