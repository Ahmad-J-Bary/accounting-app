import { useState } from "react";
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
} from "../../../api/backupService";
import { formatSize, formatTimestamp } from "../../lib/backupFormat";

interface Props {
  backups: BackupFileInfo[];
  operating: boolean;
  onImported: () => Promise<void>;
}

interface Candidate {
  path: string;
  label: string;
  inspection: DatabaseInspection;
  appVersion: string | null;
}

export function ImportPanel({ backups, operating, onImported }: Props) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handlePick = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "قاعدة بيانات SQLite", extensions: ["sqlite", "db"] }],
      });
      if (!path || typeof path !== "string") return;
      const inspection = await backupService.inspectBackupFile(path);
      const label = path.split(/[\\/]/).pop() ?? "ملف مستورد";
      const known = backups.find((b) => b.path === path);
      setCandidate({ path, label, inspection, appVersion: known?.app_version ?? null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleConfirm = async () => {
    if (!candidate) return;
    setBusy(true);
    try {
      await backupService.importFromFile(candidate.path);
      toast.success("تم تجهيز الاستيراد — سيتم إعادة تشغيل التطبيق لتطبيقه");
      setConfirmOpen(false);
      setCandidate(null);
      await onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const insp = candidate?.inspection;
  const upgradable = insp && insp.schema_version < insp.supported_version;

  return (
    <div className="space-y-4">
      <div>
        <p className="font-bold text-slate-600 text-sm">استيراد قاعدة بيانات خارجية</p>
        <p className="text-xs text-slate-400 mt-1">
          يستبدل قاعدة البيانات الحالية بملف خارجي. تُفحص سلامة القاعدة والعلاقات معًا قبل القبول، وتُنشأ نسخة
          احتياطية تلقائية من بياناتك الحالية قبل الاستيراد.
        </p>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-10"
        disabled={operating || busy}
        onClick={() => void handlePick()}
      >
        <FolderOpen className="w-4 h-4 ml-1" /> اختيار ملف قاعدة بيانات
      </Button>

      {candidate && insp && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileUp className="w-4 h-4 text-purple-600" />
            <p className="text-sm font-bold text-slate-700 truncate" dir="ltr">{candidate.label}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">تاريخ الإنشاء</span>
              <p className="font-bold text-slate-700">
                {candidate.inspection.created_at
                  ? formatTimestamp(candidate.inspection.created_at)
                  : "غير متاح"}
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
                <CheckCircle2 className="w-3.5 h-3.5" /> البنية سليمة والجداول مكتملة — جاهز للاستيراد
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> انتباه: بنية غير مكتملة أو لم يمر الفحص
              </span>
            )}
          </div>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white w-full h-10"
            disabled={operating || busy}
            onClick={() => setConfirmOpen(true)}
          >
            <ShieldCheck className="w-4 h-4 ml-1" /> استيراد
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!o) setConfirmOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الاستيراد</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  الملف: <span dir="ltr" className="font-mono text-xs">{candidate?.label}</span>
                </p>
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold leading-relaxed">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    تحذير: سيتم استبدال قاعدة البيانات الحالية بالكامل بملف المستورد.
                  </span>
                  <span className="block mt-1.5 text-rose-600">
                    تُنشأ نسخة احتياطية تلقائية من بياناتك الحالية قبل المتابعة، وسيُعاد تشغيل التطبيق لتطبيق
                    الاستيراد. لا يمكن التراجع بعد اكتمال التطبيق.
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  اخترنا لك التفاصيل أعلاه من الملف (التاريخ، الحجم، الإصدار) — راجعها قبل المتابعة.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <ShieldCheck className="w-4 h-4 ml-1" /> {busy ? "جارٍ التجهيز..." : "استيراد وإعادة التشغيل"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}