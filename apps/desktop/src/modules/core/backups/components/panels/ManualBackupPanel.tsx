import { useEffect, useState } from "react";
import { Plus, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Progress } from "@shared/ui/progress";
import { toast } from "sonner";
import {
  backupService,
  type BackupProgressPhase,
} from "../../../api/backupService";
import { formatSize } from "../../lib/backupFormat";

type Phase = "idle" | BackupProgressPhase;

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  creating: "جارٍ إنشاء النسخة الاحتياطية...",
  verifying: "جارٍ التحقق من النسخة الاحتياطية...",
  completed: "اكتمل إنشاء النسخة وتحققنا من سلامتها",
  failed: "فشل إنشاء النسخة الاحتياطية",
};

const PHASE_VALUE: Record<Phase, number> = {
  idle: 0,
  creating: 45,
  verifying: 85,
  completed: 100,
  failed: 0,
};

export function ManualBackupPanel({
  operating,
  onDone,
}: {
  operating: boolean;
  onDone: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void backupService
      .listenBackupProgress((e) => {
        if (cancelled) return;
        setPhase(e.phase);
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleBackup = async () => {
    setBusy(true);
    setPhase("creating");
    try {
      const info = await backupService.backupNow();
      setPhase("completed");
      toast.success(`تم إنشاء نسخة احتياطية (${formatSize(info.size)})`);
      await onDone();
    } catch (e) {
      setPhase("failed");
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const active = busy || operating;
  const showBar = phase !== "idle";

  return (
    <div className="space-y-4">
      <div>
        <p className="font-bold text-slate-600 text-sm">نسخة احتياطية يدوية</p>
        <p className="text-xs text-slate-400 mt-1">
          تُنشئ لقطة أمان محلية ومتسقة للقاعدة الحالية وتتحقق من سلامتها قبل الاعتراف بالنجاح.
        </p>
      </div>

      <Button
        size="sm"
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 text-sm font-bold gap-2"
        disabled={active}
        onClick={() => void handleBackup()}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 ml-1" />}
        {active && phase === "creating" ? "جارٍ الإنشاء..." : "إنشاء نسخة احتياطية الآن"}
      </Button>

      {showBar && (
        <div className="space-y-2">
          <Progress
            value={PHASE_VALUE[phase]}
            className={phase === "completed" ? "[&>div]:bg-emerald-600" : phase === "failed" ? "[&>div]:bg-rose-600" : ""}
          />
          <div className="flex items-center gap-2 text-xs font-bold">
            {phase === "completed" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {phase === "failed" && <XCircle className="w-4 h-4 text-rose-600" />}
            <span className={phase === "completed" ? "text-emerald-700" : phase === "failed" ? "text-rose-600" : "text-slate-500"}>
              {PHASE_LABEL[phase]}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}