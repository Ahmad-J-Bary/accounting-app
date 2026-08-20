import { Badge } from "@shared/ui/badge";

/** Format a byte count as B/KB/MB/GB. */
export function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Format a backup filename timestamp label (YYYYMMDD_HHMMSS) into a date-time. */
export function formatLabel(label: string): string {
  // accounting_backup_20260819_093000 -> 2026/08/19 09:30:00
  const m = label
    .replace(/^(erp_backup_|accounting_backup_|erp_pre_restore_)/, "")
    .match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!m) return label;
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
}

/** Format a unix-second timestamp as a localized date-time string. */
export function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return new Intl.DateTimeFormat("ar-SY", {
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Format a YYYYMMDD day token (from the backend's last_auto_backup). */
export function formatDayToken(token: string | null): string {
  if (!token) return "—";
  const m = token.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return token;
  return `${m[1]}/${m[2]}/${m[3]}`;
}

export function typeBadge(backup_type: string | null | undefined) {
  if (!backup_type) return null;
  const label =
    backup_type === "manual"
      ? "يدوية"
      : backup_type === "pre_import"
        ? "قبل الاستيراد"
        : "تلقائية";
  const cls =
    backup_type === "manual"
      ? "bg-blue-50 text-blue-700"
      : backup_type === "pre_import"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <Badge variant="outline" className={`${cls} text-[10px]`}>
      {label}
    </Badge>
  );
}

/** Reasons an inspected import candidate must be rejected (Arabic). */
export function inspectRejectionReason(
  inspection: {
    newer_than_supported: boolean;
    schema_version: number;
    supported_version: number;
    tables_present: boolean;
    missing_tables: string[];
    integrity_ok: boolean;
  },
  ipcErrors: string[]
): string | null {
  if (ipcErrors.length > 0) return ipcErrors.join(" • ");
  if (inspection.newer_than_supported) {
    return `رُفض الملف: إصدار قاعدة البيانات أقدم من المدعوم`;
  }
  if (!inspection.tables_present) {
    return `الملف لا يحتوي على الجداول الأساسية المطلوبة: ${inspection.missing_tables.join(", ")}`;
  }
  if (!inspection.integrity_ok) {
    return "رُفض الملف: فشل فحص سلامة قاعدة البيانات";
  }
  return null;
}