import { useEffect, useState, useCallback, useRef } from "react";
import { X, Download, RefreshCw, AlertCircle, ExternalLink, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import { useUpdateChecker } from "../hooks/useUpdateChecker";
import { cn } from "@shared/lib/utils";
import { UpdateProgress } from "./UpdateProgress";

type Phase = 'idle' | 'available' | 'downloading' | 'installing' | 'restarting' | 'failed';

const accentColor: Record<Exclude<Phase, 'idle'>, string> = {
  available:    'bg-blue-500',
  downloading:  'bg-blue-500',
  installing:   'bg-amber-500',
  restarting:   'bg-green-500',
  failed:       'bg-red-500',
};

function PhaseIcon({ phase }: { phase: Exclude<Phase, 'idle'> }) {
  switch (phase) {
    case 'available':    return <Download className="w-3.5 h-3.5" />;
    case 'downloading':  return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    case 'installing':   return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    case 'restarting':   return <RotateCcw className="w-3.5 h-3.5" />;
    case 'failed':       return <AlertCircle className="w-3.5 h-3.5" />;
  }
}

export function UpdateBanner() {
  const { updateInfo, check, dismiss, isUpdating, updateProgress, installUpdate, updateSuccess, error } = useUpdateChecker();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dismissedVersion = useRef<string | null>(null);

  const phase: Phase = (() => {
    if (error) return 'failed';
    if (updateSuccess) return 'restarting';
    if (isUpdating && updateProgress) return 'downloading';
    if (isUpdating) return 'installing';
    if (updateInfo) return 'available';
    return 'idle';
  })();

  useEffect(() => {
    if (phase !== 'idle') {
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [phase]);

  const handleDismiss = useCallback(() => {
    if (updateInfo) dismissedVersion.current = updateInfo.latest_version;
    setVisible(false);
    setTimeout(dismiss, 300);
  }, [dismiss, updateInfo]);

  const handleInstall = useCallback(() => {
    installUpdate();
  }, [installUpdate]);

  const percentage = updateProgress && updateProgress.total > 0
    ? Math.round((updateProgress.downloaded / updateProgress.total) * 100)
    : 0;

  if (phase === 'idle') return null;

  const accent = accentColor[phase];
  const isBusy = phase === 'downloading' || phase === 'installing' || phase === 'restarting';

  return (
    <div className={cn("transition-all duration-300 ease-out overflow-hidden border-b border-slate-200", visible ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0')}>
      <div className="flex flex-col bg-white text-slate-700 text-xs">
        {/* Main bar */}
        <div className="flex items-center gap-2.5 px-3 h-9">
          {/* Left accent indicator */}
          <div className={cn("w-0.5 h-4 rounded-full shrink-0", accent)} />

          {/* Icon */}
          <span className="text-slate-500 shrink-0"><PhaseIcon phase={phase} /></span>

          {/* Label */}
          <span className="flex-1 truncate font-medium">
            {phase === 'available' && updateInfo && (
              <>يتوفر تحديث <span className="font-semibold text-blue-700">{updateInfo.release_name}</span></>
            )}
            {phase === 'downloading' && <>جاري تحميل التحديث...</>}
            {phase === 'installing' && <>جاري تثبيت التحديث...</>}
            {phase === 'restarting' && <>تم تثبيت التحديث، جاري إعادة التشغيل...</>}
            {phase === 'failed' && <span className="text-red-600 font-semibold">{error || 'فشل التحديث'}</span>}
          </span>

          {/* Version pill */}
          {phase === 'available' && updateInfo && (
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-mono" dir="ltr">
              v{updateInfo.current_version}
              <span className="text-slate-300">→</span>
              <span className="font-semibold text-blue-600">v{updateInfo.latest_version}</span>
            </span>
          )}

          {/* Progress percentage (compact during download) */}
          {phase === 'downloading' && percentage > 0 && (
            <span className="text-[10px] text-slate-400 font-mono min-w-[2.5rem] text-right" dir="ltr">{percentage}%</span>
          )}

          {/* Actions */}
          {phase === 'available' && (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" onClick={handleInstall} className="h-6 px-2 text-[11px] gap-1 rounded font-medium">
                <Download className="w-3 h-3" />
                تحديث الآن
              </Button>
              {updateInfo?.release_url && (
                <a href={updateInfo.release_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 h-6 px-1.5 text-[11px] text-slate-400 hover:text-slate-600 rounded transition-colors"
                  title="ملاحظات الإصدار">
                  <ExternalLink className="w-3 h-3" />
                  <span className="hidden sm:inline">ملاحظات</span>
                </a>
              )}
              <button onClick={handleDismiss} className="p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors" title="تجاهل">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {phase === 'failed' && (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" onClick={check} className="h-6 px-2 text-[11px] gap-1 rounded font-medium">
                <RefreshCw className="w-3 h-3" />
                إعادة المحاولة
              </Button>
              <button onClick={handleDismiss} className="p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors" title="تجاهل">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Expand toggle for progress detail */}
          {isBusy && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
              title="تفاصيل التحديث"
            >
              <div className={cn("w-1 h-1 rounded-full bg-current", expanded && "hidden")} />
              <div className={cn("w-1 h-1 rounded-full bg-current mt-px", expanded && "hidden")} />
              <div className={cn("w-1 h-1 rounded-full bg-current mt-px", expanded && "hidden")} />
            </button>
          )}
        </div>

        {/* Expanded progress detail */}
        {expanded && (
          <div className="px-8 pb-3 pt-1 border-t border-slate-100">
            <UpdateProgress
              phase={phase === 'restarting' ? 'restarting' : phase === 'downloading' ? 'downloading' : 'installing'}
              percentage={percentage}
              downloaded={updateProgress?.downloaded || 0}
              total={updateProgress?.total || 0}
              error={error}
              compact={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
