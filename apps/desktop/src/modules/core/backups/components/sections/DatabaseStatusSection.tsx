import {
  ShieldCheck, AlertTriangle, CheckCircle2, Loader2,
} from "lucide-react";
import type { BackupFileInfo, BackupConfig, DatabaseInfo } from "../../../api/backupService";
import { formatTimestamp, formatDayToken } from "../../lib/backupFormat";
import { friendlyBackupError } from "../../lib/backupErrors";
import { ErrorDetails } from "../../lib/ErrorDetails";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface Props {
  dbInfo: DatabaseInfo | null;
  backups: BackupFileInfo[];
  config: BackupConfig | null;
  health: "checking" | "ok" | "error";
  healthMsg: string;
  loading: boolean;
}

export function DatabaseStatusSection({ dbInfo, backups, health, healthMsg, loading }: Props) {
  const { t } = useLocalization();
  const latest =
    [...backups].sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
  const healthErr = friendlyBackupError(healthMsg || "integrity check failed");

  return (
    <SettingsSection title={t("backups.statusTitle", { namespace: "settings",  })}>
      <div className="space-y-3">
        {loading || !dbInfo ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : health === "error" ? (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold">{t("backups.needsAttention", { namespace: "settings",  })}</p>
              <p className="text-sm">{healthErr.friendly}</p>
              <ErrorDetails detail={healthErr.detail} />
            </div>
          </div>
        ) : health === "checking" ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-muted bg-muted">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">{t("backups.checking", { namespace: "settings",  })}</p>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-success/20 bg-success/10 text-success">
            <div className="p-1.5 rounded-lg bg-success/20 shrink-0">
              <ShieldCheck className="w-5 h-5 text-success" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">{t("backups.dataIntact", { namespace: "settings",  })}</p>
              <p className="text-sm text-success">{t("backups.dataIntactDesc", { namespace: "settings",  })}</p>
            </div>
          </div>
        )}

        {/* Last backup info */}
        {dbInfo && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-muted-foreground px-1">
            <span className={dbInfo.auto_backup_enabled ? "text-success" : "text-muted-foreground"}>
              {dbInfo.auto_backup_enabled ? t("backups.autoEnabled", { namespace: "settings",  }) : t("backups.autoDisabled", { namespace: "settings",  })}
            </span>
            {dbInfo.last_auto_backup && (
              <span className="text-muted-foreground">
                {t("backups.lastDaily", { namespace: "settings",  })} {formatDayToken(dbInfo.last_auto_backup)}
              </span>
            )}
            {latest && (
              <span className="text-muted-foreground">
                {t("backups.lastBackup", { namespace: "settings",  })} {formatTimestamp(latest.timestamp)}
              </span>
            )}
            {dbInfo.last_restore_status === "rolled_back" && (
              <span className="text-destructive">
                {t("backups.rolledBack", { namespace: "settings",  })}
              </span>
            )}
            {dbInfo.last_restore_status === "applied" && (
              <span className="text-success flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t("backups.restoreComplete", { namespace: "settings",  })}
              </span>
            )}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
