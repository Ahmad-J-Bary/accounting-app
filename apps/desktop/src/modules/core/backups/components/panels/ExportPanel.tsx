import { useState } from "react";
import { Download, FileDown, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { Button } from "@shared/ui/button";
import { Progress } from "@shared/ui/progress";
import { toast } from "sonner";
import { backupService } from "../../../api/backupService";
import {
  useBackupProgress,
  BACKUP_PROGRESS_LABELS,
  backupProgressValue,
} from "@shared/hooks/useBackupProgress";
import { friendlyBackupError, type BackupError } from "../../lib/backupErrors";
import { ErrorDetails } from "../../lib/ErrorDetails";

export function ExportPanel({ onDone }: { onDone: () => Promise<void> }) {
  const phase = useBackupProgress();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<BackupError | null>(null);

  const handleExport = async () => {
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const path = await save({
        defaultPath: `almowakeb_export_${new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, "")}.sqlite`,
        filters: [{ name: "قاعدة بيانات SQLite", extensions: ["sqlite", "db"] }],
      });
      if (!path) return;
      await backupService.exportToFile(path);
      setDone(true);
      toast.success("تم تصدير قاعدة البيانات بنجاح");
      await onDone();
    } catch (e) {
      const err = friendlyBackupError(e);
      setError(err);
      toast.error(err.friendly);
    } finally {
      setBusy(false);
    }
  };

  const emitting = busy && phase === "exporting";

  return (
    <div className="space-y-4">
      <Button
        size="sm"
        variant="outline"
        className="h-10"
        disabled={busy}
        onClick={() => void handleExport()}
      >
        {emitting ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : busy ? <FileDown className="w-4 h-4 ml-1 animate-pulse" /> : <Download className="w-4 h-4 ml-1" />}
        {busy ? "جارٍ التصدير..." : "تصدير قاعدة البيانات"}
      </Button>

      {busy && phase && (
        <div role="status" aria-live="polite" className="space-y-1.5">
          <Progress
            value={backupProgressValue(phase)}
            aria-label="تقدم التصدير"
            className="[&>div]:bg-blue-600"
          />
          <p className="text-xs font-bold text-slate-500">{BACKUP_PROGRESS_LABELS[phase]}</p>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
          <CheckCircle2 className="w-4 h-4" /> اكتمل التصدير بنجاح ✓
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-700">
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <XCircle className="w-4 h-4 shrink-0" /> {error.friendly}
          </p>
          <ErrorDetails detail={error.detail} />
        </div>
      )}
    </div>
  );
}