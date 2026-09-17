import { useState, useEffect, useCallback } from "react";
import {
  Power, X, AlertTriangle, RefreshCw, DatabaseBackup,
} from "lucide-react";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import {
  backupService,
  type BackupFileInfo,
  type BackupConfig,
  type PendingRestoreInfo,
} from "../../api/backupService";
import { DatabaseStatusSection } from "./sections/DatabaseStatusSection";
import { ActionsSection } from "./sections/ActionsSection";
import { HistorySection } from "./sections/HistorySection";
import { SettingsSection } from "./sections/SettingsSection";
import { friendlyBackupError, RESTORE_STATUS_SEEN_KEY } from "../lib/backupErrors";
import { ErrorDetails } from "../lib/ErrorDetails";
import { useLocalization } from "@app/providers/LocalizationProvider";

type Health = "checking" | "ok" | "error";

export function DataBackupSection() {
  const { t, direction } = useLocalization();
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [dbInfo, setDbInfo] = useState<Awaited<ReturnType<typeof backupService.getDatabaseInfo>> | null>(null);
  const [pending, setPending] = useState<PendingRestoreInfo | null>(null);
  const [health, setHealth] = useState<Health>("checking");
  const [healthMsg, setHealthMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [restorePreset, setRestorePreset] = useState<BackupFileInfo | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [b, c, p, h, d] = await Promise.all([
        backupService.listBackups(),
        backupService.getConfig(),
        backupService.getPendingRestore(),
        backupService.getHealth(),
        backupService.getDatabaseInfo(),
      ]);
      setBackups(b);
      setConfig(c);
      setPending(p);
      setDbInfo(d);

      // One-shot toast when a restore transitioned across reloads
      const status = c?.last_restore_status ?? null;
      if (status && status !== localStorage.getItem(RESTORE_STATUS_SEEN_KEY)) {
        localStorage.setItem(RESTORE_STATUS_SEEN_KEY, status);
        const message =
          status === "applied"
            ? t("backups.restoreApplied", { namespace: "settings" })
            : status === "rolled_back"
              ? t("backups.restoreRolledBack", { namespace: "settings" })
              : null;
        if (message) {
          if (status === "applied") toast.success(message);
          else toast.error(message);
        }
      }

      if (h.status === "ok") {
        setHealth("ok");
        setHealthMsg("");
      } else {
        setHealth("error");
        setHealthMsg(h.message ?? "");
      }
    } catch (e) {
      console.error(e);
      toast.error(t("backups.loadFailed", { namespace: "settings" }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live restore-rejected signal
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    backupService
      .listenRestoreRejected((message) => {
        toast.error(
          message
            ? t("backups.restoreRejectedWithReason", {
                namespace: "settings",
                vars: { reason: friendlyBackupError(message).friendly },
              })
            : t("backups.restoreRejected", { namespace: "settings" }),
        );
        void load(true);
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      unlisten?.();
    };
  }, [load]);

  const handleConfigChange = async (patch: Partial<BackupConfig>) => {
    try {
      const saved = await backupService.setConfig({
        use_same_location: patch.use_same_location,
        custom_path: patch.custom_path,
        keep_daily: patch.keep_daily,
        keep_weekly: patch.keep_weekly,
        keep_monthly: patch.keep_monthly,
        auto_backup_enabled: patch.auto_backup_enabled,
      });
      setConfig(saved);
    } catch (e) {
      toast.error(friendlyBackupError(e).friendly);
    }
  };

  const handleRetention = async () => {
    setOperating(true);
    try {
      const res = await backupService.applyRetention();
      toast.success(
        res.removed.length > 0
          ? t("backups.retentionRemoved", {
              namespace: "settings",
              vars: { count: res.removed.length },
            })
          : t("backups.retentionNothingToRemove", { namespace: "settings" })
      );
      await load(true);
    } catch (e) {
      toast.error(friendlyBackupError(e).friendly);
    } finally {
      setOperating(false);
    }
  };

  const handleRestore = async (b: BackupFileInfo) => {
    setRestorePreset(b);
  };

  const handlePresetConsumed = () => {
    setRestorePreset(null);
  };

  const handleCancelRestore = async () => {
    try {
      await backupService.cancelPendingRestore();
      setPending(null);
      toast.info(t("backups.pendingRestoreCanceled", { namespace: "settings" }));
    } catch (e) {
      toast.error(friendlyBackupError(e).friendly);
    }
  };

  const handleRestart = async () => {
    try {
      await backupService.requestRestart();
    } catch (e) {
      toast.error(friendlyBackupError(e).friendly);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-black text-muted-foreground">{t("backups.loadingData", { namespace: "settings" })}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 lg:p-6 space-y-6" dir={direction}>
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <DatabaseBackup className="w-6 h-6 text-primary" />
            {t("nav.backups", { namespace: "settings" })}
          </h1>
          <p className="text-muted-foreground font-medium text-base">{t("backups.pageDescription", { namespace: "settings" })}</p>
        </div>
        <Button onClick={() => void load(true)} variant="outline" size="sm">
          <RefreshCw className="ms-1 h-4 w-4" /> {t("actions.refresh", { namespace: "common" })}
        </Button>
      </header>

      {/* Health error banner */}
      {health === "error" && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-bold">{t("backups.healthCheckFailed", { namespace: "settings" })}</p>
            <p className="text-sm mt-1">{friendlyBackupError(healthMsg || "integrity check failed").friendly}</p>
            <ErrorDetails detail={friendlyBackupError(healthMsg || "integrity check failed").detail} />
          </div>
        </div>
      )}

      {/* Pending restore banner */}
      {pending && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
          <div className="flex items-center gap-2">
            <Power className="w-5 h-5" />
            <span className="font-bold">
              {t("backups.pendingRestoreFrom", {
                namespace: "settings",
                vars: { source: pending.source_label },
              })}
            </span>
            <span className="text-sm">- {t("backups.pendingRestoreRestartHint", { namespace: "settings" })}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRestart} disabled={operating}>
              {t("backups.restartNow", { namespace: "settings" })}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelRestore} disabled={operating}>
              <X className="ms-1 h-4 w-4" /> {t("actions.cancel", { namespace: "common" })}
            </Button>
          </div>
        </div>
      )}

      {/* Rollback banner */}
      {config?.last_restore_status === "rolled_back" && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-bold">{t("backups.rolledBackTitle", { namespace: "settings" })}</p>
            <p className="text-sm mt-1">{t("backups.rolledBackDescription", { namespace: "settings" })}</p>
          </div>
        </div>
      )}

      {/* Section 1: Data Status */}
      <DatabaseStatusSection
        dbInfo={dbInfo}
        backups={backups}
        config={config}
        health={health}
        healthMsg={healthMsg}
        loading={loading}
      />

      {/* Section 2: Data Actions */}
      <ActionsSection
        operating={operating}
        onDone={() => load(true)}
        preset={restorePreset}
        onPresetConsumed={handlePresetConsumed}
      />

      {/* Section 3: Backup History */}
      <HistorySection
        backups={backups}
        pending={pending}
        operating={operating}
        onRestore={handleRestore}
        onDone={() => load(true)}
      />

      {/* Section 4-6: Settings */}
      {config && (
        <SettingsSection
          config={config}
          operating={operating}
          onConfigChange={handleConfigChange}
          onApplyRetention={handleRetention}
        />
      )}
    </div>
  );
}
