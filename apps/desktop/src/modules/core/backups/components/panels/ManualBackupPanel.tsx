import { useState } from "react";
import { Plus, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Progress } from "@shared/ui/progress";
import { toast } from "sonner";
import { backupService } from "../../../api/backupService";
import {
  useBackupProgress,
  BACKUP_PROGRESS_LABELS,
  backupProgressValue,
} from "@shared/hooks/useBackupProgress";
import { formatSize } from "../../lib/backupFormat";

export function ManualBackupPanel({
  operating,
  onDone,
}: {
  operating: boolean;
  onDone: () => Promise<void>;
}) {
  const phase = useBackupProgress();
  const [busy, setBusy] = useState(false);

  const handleBackup = async () => {
    setBusy(true);
    try {
      const info = await backupService.backupNow();
      toast.success(`تم إنشاء النسخة ✓ (${formatSize(info.size)})`);
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const active = busy || operating;
  const showPhase =
    (busy || operating) && phase !== null && phase !== "completed" && phase !== "failed";

  const label =
    phase && (busy || operating)
      ? BACKUP_PROGRESS_LABELS[phase]
      : null;

  return (
    <div className="space-y-4">
      <Button
        size="sm"
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 text-sm font-bold gap-2"
        disabled={active}
        onClick={() => void handleBackup()}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 ml-1" />}
        {busy ? "جارٍ الإنشاء..." : "إنشاء نسخة احتياطية الآن"}
      </Button>

      {showPhase && label && (
        <div role="status" aria-live="polite" className="space-y-2">
          <Progress
            value={backupProgressValue(phase === "staged" ? "staged" : phase)}
            aria-label="تقدم النسخة الاحتياطية"
            className="[&>div]:bg-blue-600"
          />
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-slate-500">{label}</span>
          </div>
        </div>
      )}

      {phase === "completed" && !busy && !operating && (
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {BACKUP_PROGRESS_LABELS.completed}
        </div>
      )}
      {phase === "failed" && !busy && !operating && (
        <div className="flex items-center gap-2 text-xs font-bold text-rose-600">
          <XCircle className="w-4 h-4 text-rose-600" />
          {BACKUP_PROGRESS_LABELS.failed}
        </div>
      )}
    </div>
  );
}