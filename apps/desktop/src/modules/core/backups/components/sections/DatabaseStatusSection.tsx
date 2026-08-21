import {
  ShieldCheck, AlertTriangle, CheckCircle2, Loader2,
} from "lucide-react";
import type { BackupFileInfo, BackupConfig, DatabaseInfo } from "../../../api/backupService";
import { formatTimestamp, formatDayToken } from "../../lib/backupFormat";
import { friendlyBackupError } from "../../lib/backupErrors";
import { ErrorDetails } from "../../lib/ErrorDetails";
import { SettingsSection } from "@widgets/templates/SettingsLayout";

interface Props {
  dbInfo: DatabaseInfo | null;
  backups: BackupFileInfo[];
  config: BackupConfig | null;
  health: "checking" | "ok" | "error";
  healthMsg: string;
  loading: boolean;
}

export function DatabaseStatusSection({ dbInfo, backups, health, healthMsg, loading }: Props) {
  const latest =
    [...backups].sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
  const healthErr = friendlyBackupError(healthMsg || "integrity check failed");

  return (
    <SettingsSection title="حالة البيانات">
      <div className="space-y-3">
        {loading || !dbInfo ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : health === "error" ? (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold">يحتاج إلى انتباه</p>
              <p className="text-sm">{healthErr.friendly}</p>
              <ErrorDetails detail={healthErr.detail} />
            </div>
          </div>
        ) : health === "checking" ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            <p className="text-sm text-slate-500">جاري الفحص...</p>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <div className="p-1.5 rounded-lg bg-emerald-100 shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-emerald-800">البيانات سليمة</p>
              <p className="text-sm text-emerald-700">بياناتك محفوظة بشكل آمن ومتسق.</p>
            </div>
          </div>
        )}

        {/* Last backup info */}
        {dbInfo && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-500 px-1">
            <span className={dbInfo.auto_backup_enabled ? "text-emerald-600" : "text-slate-400"}>
              {dbInfo.auto_backup_enabled ? "النسخ التلقائي مفعّل" : "النسخ التلقائي معطّل"}
            </span>
            {dbInfo.last_auto_backup && (
              <span className="text-slate-400">
                آخر نسخة يومية: {formatDayToken(dbInfo.last_auto_backup)}
              </span>
            )}
            {latest && (
              <span className="text-slate-400">
                آخر نسخة احتياطية: {formatTimestamp(latest.timestamp)}
              </span>
            )}
            {dbInfo.last_restore_status === "rolled_back" && (
              <span className="text-rose-600">
                ⚠ تم التراجع عن استعادة سابقة
              </span>
            )}
            {dbInfo.last_restore_status === "applied" && (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> اكتملت استعادة سابقة
              </span>
            )}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
