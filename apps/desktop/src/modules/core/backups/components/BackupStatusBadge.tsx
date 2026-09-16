import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { BackupFileInfo } from "../../api/backupService";
import { backupStatus } from "../lib/backupFormat";

const TONE = {
  emerald: "bg-success/10 text-success border-success/20",
  amber: "bg-warning/10 text-warning border-warning/20",
  rose: "bg-destructive/10 text-destructive border-destructive/20",
} as const;

const KEBAB = {
  emerald: "bg-success",
  amber: "bg-warning",
  rose: "bg-destructive",
} as const;

const ICON = {
  emerald: <CheckCircle2 className="w-3 h-3" />,
  amber: <AlertTriangle className="w-3 h-3" />,
  rose: <XCircle className="w-3 h-3" />,
} as const;

/** Shared ledger-status pill for backup files — single source of truth for look & tone. */
export function BackupStatusBadge({
  backup,
  icon = false,
  className = "",
}: {
  backup: BackupFileInfo;
  icon?: boolean;
  className?: string;
}) {
  const s = backupStatus(backup);
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONE[s.tone]} ${className}`}
    >
      {icon ? (
        ICON[s.tone]
      ) : (
        <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${KEBAB[s.tone]}`} />
      )}
      {s.label}
    </span>
  );
}