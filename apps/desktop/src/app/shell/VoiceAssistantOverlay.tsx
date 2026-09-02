import { Mic, Loader2, CheckCircle2, AlertTriangle, Wand2 } from "lucide-react";
import { useVoice } from "@app/providers/VoiceProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";
import { useLocalization } from "@app/providers/LocalizationProvider";

const STATE_ICON = {
  idle: Mic,
  recording: Mic,
  transcribing: Loader2,
  analyzing: Wand2,
  confirmation: Wand2,
  executing: Loader2,
  success: CheckCircle2,
  error: AlertTriangle,
  ambiguous: AlertTriangle,
} as const;

export function VoiceAssistantOverlay() {
  const { isOpen, close, state, transcript, candidates, confirmCommand } = useVoice();
  const { t } = useLocalization();
  const Icon = STATE_ICON[state];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? close() : undefined)}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${state === "recording" || state === "executing" ? "animate-pulse" : ""}`} />
            {t("title", { namespace: "voice" })}
          </DialogTitle>
          <DialogDescription>{t(state, { namespace: "voice" })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {transcript || t("idle", { namespace: "voice" })}
          </div>

          {candidates.length > 0 && (
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <Button
                  key={candidate.commandId}
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => confirmCommand(candidate.commandId)}
                >
                  {candidate.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
