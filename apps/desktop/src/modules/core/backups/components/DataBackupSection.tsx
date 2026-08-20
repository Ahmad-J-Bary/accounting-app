import { useState, useEffect, useCallback } from "react";
import {
  Info, Settings2, PlusCircle, Archive, Upload, Download,
  Power, X, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { Button } from "@shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@shared/ui/alert-dialog";
import { toast } from "sonner";
import {
  backupService,
  type BackupFileInfo,
  type BackupConfig,
  type PendingRestoreInfo,
} from "../../api/backupService";
import { DatabaseInfoPanel } from "./panels/DatabaseInfoPanel";
import { BackupSettingsPanel } from "./panels/BackupSettingsPanel";
import { ManualBackupPanel } from "./panels/ManualBackupPanel";
import { BackupListPanel } from "./panels/BackupListPanel";
import { ImportPanel } from "./panels/ImportPanel";
import { ExportPanel } from "./panels/ExportPanel";
import { formatLabel } from "../lib/backupFormat";

type Health = "checking" | "ok" | "error";

const TABS = [
  { id: "info", label: "معلومات قاعدة البيانات", icon: Info },
  { id: "settings", label: "إعدادات النسخ", icon: Settings2 },
  { id: "manual", label: "نسخة يدوية", icon: PlusCircle },
  { id: "list", label: "النسخ الاحتياطية", icon: Archive },
  { id: "import", label: "استيراد", icon: Upload },
  { id: "export", label: "تصدير", icon: Download },
];

export function DataBackupSection() {
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [dbInfo, setDbInfo] = useState<Awaited<ReturnType<typeof backupService.getDatabaseInfo>> | null>(null);
  const [pending, setPending] = useState<PendingRestoreInfo | null>(null);
  const [health, setHealth] = useState<Health>("checking");
  const [healthMsg, setHealthMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupFileInfo | null>(null);

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
    setRestoreTarget(b);
  };

  const handleRestoreConfirmed = async () => {
    if (!restoreTarget) return;
    setOperating(true);
    try {
      await backupService.importFromFile(restoreTarget.path);
      toast.success("تم تجهيز الاستعادة — سيتم إعادة تشغيل التطبيق لتطبيقها");
      setRestoreTarget(null);
      const p = await backupService.getPendingRestore();
      setPending(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOperating(false);
    }
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
    <div className="space-y-4" dir="rtl">
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

      <Tabs defaultValue="info" className="w-full">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="flex items-center gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-3 py-2"
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button onClick={() => void load(true)} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 ml-1" /> تحديث
          </Button>
        </div>

        <TabsContent value="info" className="mt-4">
          <DatabaseInfoPanel
            dbInfo={dbInfo}
            backups={backups}
            config={config}
            health={health}
            healthMsg={healthMsg}
            loading={loading}
          />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          {config && (
            <BackupSettingsPanel
              config={config}
              operating={operating}
              onConfigChange={handleConfigChange}
              onApplyRetention={handleRetention}
            />
          )}
        </TabsContent>
        <TabsContent value="manual" className="mt-4">
          <ManualBackupPanel operating={operating} onDone={() => load(true)} />
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          <BackupListPanel
            backups={backups}
            pending={pending}
            operating={operating}
            onRestore={handleRestore}
            onDone={() => load(true)}
          />
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          <ImportPanel backups={backups} operating={operating} onImported={() => load(true)} />
        </TabsContent>
        <TabsContent value="export" className="mt-4">
          <ExportPanel onDone={() => load(true)} />
        </TabsContent>
      </Tabs>

      {/* Restore confirmation */}
      {restoreTarget && (
        <AlertDialog open onOpenChange={(o) => { if (!o) setRestoreTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الاستعادة</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-sm">
                    النسخة: <span dir="ltr" className="font-mono text-xs">{restoreTarget.name}</span> —{" "}
                    {formatLabel(restoreTarget.label)}
                  </p>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm font-bold leading-relaxed">
                    سيتم استبدال قاعدة البيانات الحالية. سيتم إنشاء نسخة احتياطية تلقائية لبياناتك الحالية قبل
                    المتابعة.
                  </div>
                  <p className="text-xs text-slate-500">
                    ستعود قاعدة البيانات الحالية للعمل بهذه النسخة، وسيُعاد تشغيل التطبيق لتطبيق التغيير.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={operating}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                disabled={operating}
                onClick={(e) => { e.preventDefault(); void handleRestoreConfirmed(); }}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {operating ? "جارٍ التحقق..." : "متابعة وإعادة التشغيل"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}