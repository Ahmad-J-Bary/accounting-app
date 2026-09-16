import { useState } from "react";
import { Plus, XCircle, Loader2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { backupService } from "../../../api/backupService";
import { formatSize } from "../../lib/backupFormat";
import { friendlyBackupError, type BackupError } from "../../lib/backupErrors";
import { ErrorDetails } from "../../lib/ErrorDetails";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function ManualBackupPanel({
  operating,
  onDone,
}: {
  operating: boolean;
  onDone: () => Promise<void>;
}) {
  const { t } = useLocalization();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BackupError | null>(null);

  const handleBackup = async () => {
    setBusy(true);
    setError(null);
    try {
      const info = await backupService.backupNow();
      toast.success(t("manualBackup.createdSuccess", { namespace: "widgets", vars: { size: formatSize(info.size) } }));
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
        <p className="font-bold text-foreground text-sm">{t("manualBackup.title", { namespace: "widgets",  })}</p>
        <p className="text-xs text-muted-foreground">{t("manualBackup.description", { namespace: "widgets",  })}</p>
      </div>
      <Button
        className="bg-primary hover:bg-primary/80 text-white rounded-xl h-10 text-sm font-bold gap-2 w-full"
        disabled={busy || operating}
        onClick={() => void handleBackup()}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 ml-1" />}
        {busy ? t("manualBackup.creating", { namespace: "widgets",  }) : t("manualBackup.title", { namespace: "widgets",  })}
      </Button>
      {error && !busy && (
        <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-destructive">
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <XCircle className="w-4 h-4 shrink-0" /> {error.friendly}
          </p>
          <ErrorDetails detail={error.detail} />
        </div>
      )}
    </div>
  );
}
