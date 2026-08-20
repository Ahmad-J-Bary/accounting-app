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

type Health = "checking" | "ok" | "error";

export function DataBackupSection() {
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
      if (h.status === "ok") {
        setHealth("ok");
        setHealthMsg("");
      } else {
        setHealth("error");
        setHealthMsg(h.message ?? "");
      }
    } catch (e) {
      console.error(e);
      toast.error("فشل تحميل بيانات النسخ الاحتياطي");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
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
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRetention = async () => {
    setOperating(true);
    try {
      const res = await backupService.applyRetention();
      toast.success(
        res.removed.length > 0 ? `تمت إزالة ${res.removed.length} نسخة قديمة` : "لا توجد نسخ قديمة لإزالتها"
      );
      await load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
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
      toast.info("تم إلغاء الاستعادة المعلقة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRestart = async () => {
    try {
      await backupService.requestRestart();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading && !config) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-black text-slate-400">جاري تحميل البيانات والنسخ الاحتياطية...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <DatabaseBackup className="w-5 h-5 text-blue-600" />
          البيانات والنسخ الاحتياطية
        </h2>
        <Button onClick={() => void load(true)} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 ml-1" /> تحديث
        </Button>
      </div>

      {/* Health error banner */}
      {health === "error" && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-bold">تحذير: فشل فحص سلامة قاعدة البيانات</p>
            <p className="text-sm mt-1">{healthMsg || "يرجى إنشاء نسخة احتياطية فورًا والاتصال بالدعم."}</p>
          </div>
        </div>
      )}

      {/* Pending restore banner */}
      {pending && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
          <div className="flex items-center gap-2">
            <Power className="w-5 h-5" />
            <span className="font-bold">استعادة معلقة من «{pending.source_label}»</span>
            <span className="text-sm">— أعد تشغيل التطبيق لإتمام الاستعادة</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRestart} disabled={operating}>
              إعادة التشغيل الآن
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelRestore} disabled={operating}>
              <X className="w-4 h-4 ml-1" /> إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* Rollback banner */}
      {config?.last_restore_status === "rolled_back" && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-bold">تم التراجع عن الاستعادة تلقائيًا</p>
            <p className="text-sm mt-1">
              رُفضت البيانات المستوردة بعد الفحص (السلامة/العلاقات) وتمت استعادة قاعدتك السابقة. بياناتك السابقة سليمة.
            </p>
          </div>
        </div>
      )}

      <DatabaseStatusSection
        dbInfo={dbInfo}
        backups={backups}
        config={config}
        health={health}
        healthMsg={healthMsg}
        loading={loading}
      />

      <ActionsSection
        operating={operating}
        onDone={() => load(true)}
        preset={restorePreset}
        onPresetConsumed={handlePresetConsumed}
      />

      <HistorySection
        backups={backups}
        pending={pending}
        operating={operating}
        onRestore={handleRestore}
        onDone={() => load(true)}
      />

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