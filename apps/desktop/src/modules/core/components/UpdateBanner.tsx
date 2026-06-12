import { useEffect, useState, useCallback } from "react";
import { 
  X, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  ExternalLink, 
  RotateCcw, 
  ArrowDownToLine, 
  CheckCircle2,
  Globe
} from "lucide-react";
import { Button } from "@shared/ui/button";
import { useUpdateChecker, type UpdatePhase } from "../hooks/useUpdateChecker";
import { cn } from "@shared/lib/utils";
import { UpdateProgress } from "./UpdateProgress";

const accentColor: Record<Exclude<UpdatePhase, 'idle'>, string> = {
  available:    'bg-blue-500',
  downloading:  'bg-blue-500',
  preparing:    'bg-amber-500',
  ready:        'bg-green-500',
  failed:       'bg-red-500',
};

function PhaseIcon({ phase }: { phase: Exclude<UpdatePhase, 'idle'> }) {
  switch (phase) {
    case 'available':    return <ArrowDownToLine className="w-4 h-4" />;
    case 'downloading':  return <Download className="w-4 h-4 animate-spin" />;
    case 'preparing':    return <RotateCcw className="w-4 h-4 animate-spin" />;
    case 'ready':        return <CheckCircle2 className="w-4 h-4" />;
    case 'failed':       return <AlertCircle className="w-4 h-4" />;
  }
}

export function UpdateBanner() {
  const { 
    updateInfo, 
    check, 
    dismiss, 
    startUpdate,
    restartToUpdate,
    retry,
    phase,
    updateProgress, 
    error 
  } = useUpdateChecker();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (phase !== 'idle') {
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      setExpanded(false);
    }
  }, [phase]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(dismiss, 300);
  }, [dismiss]);

  const percentage = updateProgress && updateProgress.total > 0
    ? Math.round((updateProgress.downloaded / updateProgress.total) * 100)
    : 0;

  if (phase === 'idle') return null;

  const accent = accentColor[phase];
  const isBusy = phase === 'downloading' || phase === 'preparing';

  return (
    <div className={cn(
      "transition-all duration-300 ease-out overflow-hidden border-b border-slate-200",
      visible ? 'opacity-100' : 'opacity-0',
      expanded ? 'max-h-80' : 'max-h-16'
    )}>
      <div className="flex flex-col bg-white text-slate-700">
        {/* Main bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Left accent indicator */}
          <div className={cn("w-1.5 h-6 rounded-full shrink-0", accent)} />

          {/* Icon */}
          <span className={cn("shrink-0", phase === 'failed' ? 'text-red-500' : phase === 'ready' ? 'text-green-500' : 'text-blue-500')}>
            <PhaseIcon phase={phase} />
          </span>

          {/* Label */}
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-sm font-semibold">
              {phase === 'available' && updateInfo && (
                <>يتوفر تحديث جديد لـ <span className="text-blue-700">{updateInfo.release_name}</span></>
              )}
              {phase === 'downloading' && <>جاري تحميل التحديث...</>}
              {phase === 'preparing' && <>جاري تحضير التحديث...</>}
              {phase === 'ready' && <>التحديث جاهز! اضغط لإعادة تشغيل</>}
              {phase === 'failed' && <span className="text-red-600">{error || 'فشل التحديث'}</span>}
            </span>
            {phase === 'available' && updateInfo && (
              <span className="text-xs text-slate-500 font-mono" dir="ltr">
                v{updateInfo.current_version} → v{updateInfo.latest_version}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {phase === 'available' && (
              <>
                {updateInfo?.release_url && (
                  <a
                    href={updateInfo.release_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="ملاحظات الإصدار"
                  >
                    <Globe className="w-4 h-4" />
                    <span className="hidden sm:inline">ملاحظات</span>
                  </a>
                )}
                <Button 
                  size="sm" 
                  onClick={startUpdate} 
                  className="h-9 px-4 text-sm gap-1.5 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="w-4 h-4" />
                  تحديث الآن
                </Button>
              </>
            )}

            {phase === 'ready' && (
              <Button 
                size="sm" 
                onClick={restartToUpdate} 
                className="h-9 px-4 text-sm gap-1.5 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white"
              >
                <RotateCcw className="w-4 h-4" />
                إعادة تشغيل
              </Button>
            )}

            {phase === 'failed' && (
              <Button 
                size="sm" 
                onClick={retry} 
                className="h-9 px-4 text-sm gap-1.5 rounded-lg font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </Button>
            )}

            {(phase === 'available' || phase === 'failed') && (
              <button 
                onClick={handleDismiss} 
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" 
                title="تجاهل"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {isBusy && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="تفاصيل التحديث"
              >
                {expanded ? 
                  <div className="w-4 h-4 flex flex-col items-center justify-center gap-0.5">
                    <div className="w-1.5 h-0.5 bg-current rounded-full" />
                  </div> :
                  <div className="w-4 h-4 flex flex-col items-center justify-center gap-0.5">
                    <div className="w-1.5 h-0.5 bg-current rounded-full" />
                    <div className="w-1.5 h-0.5 bg-current rounded-full" />
                  </div>
                }
              </button>
            )}
          </div>
        </div>

        {/* Expanded progress detail */}
        {expanded && isBusy && (
          <div className="px-6 pb-4 pt-1 border-t border-slate-100">
            <UpdateProgress
              phase={phase === 'downloading' ? 'downloading' : 'preparing'}
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
