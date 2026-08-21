import { useState } from "react";
import { Plus, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { backupService } from "../../../api/backupService";
import { formatSize } from "../../lib/backupFormat";
import { friendlyBackupError, type BackupError } from "../../lib/backupErrors";
import { ErrorDetails } from "../../lib/ErrorDetails";

export function ManualBackupPanel({
  operating,
  onDone,
}: {
  operating: boolean;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BackupError | null>(null);

  const handleBackup = async () => {
    setBusy(true);
    setError(null);
    try {
      const info = await backupService.backupNow();
      toast.success(`تم إنشاء النسخة ✓ (${formatSize(info.size)})`);
      await onDone();
    } catch (e) {
      const err = friendlyBackupError(e);
      setError(err);
      toast.error(err.friendly);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="font-bold text-slate-800 text-sm">إنشاء نسخة احتياطية الآن</p>
        <p className="text-xs text-slate-400">حفظ نسخة آمنة من قاعدة بياناتك الحالية.</p>
      </div>
      <Button
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 text-sm font-bold gap-2 w-full"
        disabled={busy || operating}
        onClick={() => void handleBackup()}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 ml-1" />}
        {busy ? "جارٍ الإنشاء..." : "إنشاء نسخة احتياطية الآن"}
      </Button>
      {error && !busy && (
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
