import { useEffect, useState } from "react";
import { FolderOpen, FileUp, AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";
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
  type DatabaseInspection,
} from "../../api/backupService";
import { formatSize, formatTimestamp, inspectRejectionReason } from "../lib/backupFormat";

export type InspectMode = "import" | "restore";

interface Props {
  mode: InspectMode;
  operating: boolean;
  preset?: BackupFileInfo | null;
  onPresetConsumed?: () => void;
  onDone: () => Promise<void>;
}

interface Candidate {
  path: string;
  label: string;
  inspection: DatabaseInspection;
  appVersion: string | null;
}

const MODE = {
  import: {
    pickLabel: "اختيار ملف قاعدة بيانات",
    confirmTitle: "تأكيد الاستيراد",
    warningHeading: "تحذير: سيتم استبدال قاعدة البيانات الحالية بالكامل بملف المستورد.",
    warningBody:
      "تُنشأ نسخة احتياطية تلقائية من بياناتك الحالية قبل المتابعة، وسيُعاد تشغيل التطبيق لتطبيق الاستيراد. لا يمكن التراجع بعد اكتمال التطبيق.",
    actionLabel: "استيراد وإعادة التشغيل",
    actionBusy: "جارٍ التجهيز...",
    doneToast: "تم تجهيز الاستيراد — سيتم إعادة تشغيل التطبيق لتطبيقه",
    note: "اخترنا لك التفاصيل أعلاه من الملف (التاريخ، الحجم، الإصدار) — راجعها قبل المتابعة.",
    primary: "bg-purple-600 hover:bg-purple-700",
    icon: "text-purple-600",
  },
  restore: {
    pickLabel: "اختيار نسخة احتياطية أو ملف قاعدة بيانات",
    confirmTitle: "تأكيد الاستعادة",
    warningHeading: "سيتم استبدال قاعدة البيانات الحالية.",
    warningBody:
      "سيتم إنشاء نسخة احتياطية تلقائية من بياناتك الحالية قبل المتابعة، وسيُعاد تشغيل التطبيق لتطبيق الاستعادة.",
    actionLabel: "متابعة وإعادة التشغيل",
    actionBusy: "جارٍ التحقق...",
    doneToast: "تم تجهيز الاستعادة — سيتم إعادة تشغيل التطبيق لتطبيقها",
    note: "اخترنا لك التفاصيل أعلاه من الملف — راجعها قبل المتابعة.",
    primary: "bg-amber-600 hover:bg-amber-700",
    icon: "text-amber-600",
  },
} as const;

export function InspectFileFlow({ mode, operating, preset = null, onPresetConsumed, onDone }: Props) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const copy = MODE[mode];

  useEffect(() => {
    if (!preset) return;
    let cancelled = false;
    void (async () => {
      try {
        const inspection = await backupService.inspectBackupFile(preset.path);
        if (!cancelled) {
          setCandidate({ path: preset.path, label: preset.label, inspection, appVersion: preset.app_version });
          setConfirmOpen(false);
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preset]);

  const handlePick = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "قاعدة بيانات SQLite", extensions: ["sqlite", "db"] }],
      });
      if (!path || typeof path !== "string") return;
      const inspection = await backupService.inspectBackupFile(path);
      const label = path.split(/[\\/]/).pop() ?? "ملف مستورد";
      setCandidate({ path, label, inspection, appVersion: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleConfirm = async () => {
    if (!candidate) return;
    setBusy(true);
    try {
      await backupService.importFromFile(candidate.path);
      toast.success(copy.doneToast);
      setConfirmOpen(false);
      setCandidate(null);
      onPresetConsumed?.();
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const insp = candidate?.inspection ?? null;
  const reject = insp ? inspectRejectionReason(insp, []) : null;
  const upgradable = insp ? insp.schema_version < insp.supported_version : false;
  const disabled = operating || busy;

  return (
    <div className="space-y-3">
      <Button
        size="sm"
        variant="outline"
        className="h-10"
        disabled={disabled}
        onClick={() => void handlePick()}
      >
        <FolderOpen className="w-4 h-4 ml-1" /> {copy.pickLabel}
      </Button>

      {candidate && insp && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileUp className={`w-4 h-4 ${copy.icon}`} />
            <p className="text-sm font-bold text-slate-700 truncate" dir="ltr">{candidate.label}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">تاريخ الإنشاء</span>
              <p className="font-bold text-slate-700">
                {insp.created_at ? formatTimestamp(insp.created_at) : "غير متاح"}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">الحجم</span>
              <p className="font-bold text-slate-700">{formatSize(insp.size_bytes)}</p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">إصدار القاعدة</span>
              <p className="font-bold text-slate-700">
                <span dir="ltr" className="font-mono">{insp.schema_version}</span>
                {insp.newer_than_supported ? (
                  <Badge variant="outline" className="ml-1 bg-rose-50 text-rose-700 text-[10px]">أحدث من المدعوم</Badge>
                ) : upgradable ? (
                  <span className="text-amber-600 mr-1">(سيتم ترقيته إلى {insp.supported_version})</span>
                ) : null}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">إصدار التطبيق</span>
              <p className="font-bold text-slate-700">{candidate.appVersion ?? "غير معروف"}</p>
            </div>
          </div>
          {insp.company_scope ? (
            <div className="text-xs text-slate-600">
              الشركة: <span className="font-bold">{insp.company_scope}</span>
            </div>
          ) : null}
          <div className="text-xs text-slate-600">
            القيود: {insp.journal_entry_count.toLocaleString("ar-EG")} • الحسابات:{" "}
            {insp.account_count.toLocaleString("ar-EG")}
          </div>
          <div
            className={`text-xs font-bold ${
              insp.tables_present && insp.integrity_ok ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {insp.tables_present && insp.integrity_ok ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> البنية سليمة والجداول مكتملة — جاهز للمتابعة
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> انتباه: بنية غير مكتملة أو لم يمر الفحص
              </span>
            )}
          </div>
          {reject ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{reject}</span>
            </div>
          ) : (
            <Button
              size="sm"
              className={`${copy.primary} text-white w-full h-10`}
              disabled={disabled}
              onClick={() => setConfirmOpen(true)}
            >
              <ShieldCheck className="w-4 h-4 ml-1" /> {mode === "import" ? "استيراد" : "استعادة"}
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!o) setConfirmOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  الملف: <span dir="ltr" className="font-mono text-xs">{candidate?.label}</span>
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <span className="text-slate-400 font-medium">الحجم</span>
                  <span className="font-bold text-slate-700">{candidate ? formatSize(candidate.inspection.size_bytes) : "—"}</span>
                  <span className="text-slate-400 font-medium">إصدار القاعدة</span>
                  <span dir="ltr" className="font-mono font-bold text-slate-700">{candidate?.inspection.schema_version ?? "—"}</span>
                  <span className="text-slate-400 font-medium">الشركة</span>
                  <span className="font-bold text-slate-700">{candidate?.inspection.company_scope ?? "—"}</span>
                  <span className="text-slate-400 font-medium">القيود</span>
                  <span className="font-bold text-slate-700">{candidate ? candidate.inspection.journal_entry_count.toLocaleString("ar-EG") : "—"}</span>
                  <span className="text-slate-400 font-medium">الحسابات</span>
                  <span className="font-bold text-slate-700">{candidate ? candidate.inspection.account_count.toLocaleString("ar-EG") : "—"}</span>
                  <span className="text-slate-400 font-medium">الفحص</span>
                  <span className={`font-bold ${candidate && candidate.inspection.tables_present && candidate.inspection.integrity_ok ? "text-emerald-600" : "text-rose-600"}`}>
                    {candidate && candidate.inspection.tables_present && candidate.inspection.integrity_ok
                      ? "نجح الفحص ✓"
                      : "لم يمر الفحص"}
                  </span>
                </div>
                {reject ? (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{reject}</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm font-bold leading-relaxed">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {copy.warningHeading}
                    </span>
                    <span className="block mt-1.5 text-amber-700">{copy.warningBody}</span>
                  </div>
                )}
                <p className="text-xs text-slate-500">{copy.note}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !!reject}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              className={reject ? "bg-slate-400" : copy.primary}
            >
              <ShieldCheck className="w-4 h-4 ml-1" /> {busy ? copy.actionBusy : copy.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}