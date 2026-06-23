import { useEffect, useState, useCallback, useRef } from "react";
import { 
  X, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  ExternalLink, 
  RotateCcw, 
  ArrowDownToLine, 
  CheckCircle2,
  Globe,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { Button } from "@shared/ui/button";
import { useUpdateChecker } from "../hooks/useUpdateChecker";
import { cn } from "@shared/lib/utils";
import { UpdateProgress } from "./UpdateProgress";

type BannerPhase = 'available' | 'downloading' | 'preparing' | 'ready' | 'failed';

const accentColor: Record<BannerPhase, string> = {
  available:    'bg-blue-500',
  downloading:  'bg-blue-500',
  preparing:    'bg-amber-500',
  ready:        'bg-green-500',
  failed:       'bg-red-500',
};

function PhaseIcon({ phase }: { phase: BannerPhase }) {
  switch (phase) {
    case 'available':    return <ArrowDownToLine className="w-4 h-4" />;
    case 'downloading':  return <Download className="w-4 h-4 animate-spin" />;
    case 'preparing':    return <RotateCcw className="w-4 h-4 animate-spin" />;
    case 'ready':        return <CheckCircle2 className="w-4 h-4" />;
    case 'failed':       return <AlertCircle className="w-4 h-4" />;
  }
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb > 100) return mb.toFixed(0) + ' MB';
  if (mb > 1) return mb.toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

export function UpdateBanner() {
  const { updateInfo, phase, error, updateProgress, startUpdate, restartToUpdate, dismiss, retry } = useUpdateChecker();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const downloadStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== 'idle') {
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      setExpanded(false);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'downloading') {
      downloadStartRef.current = Date.now();
    }
  }, [phase]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(dismiss, 300);
  }, [dismiss]);

  if (phase === 'idle' || !updateInfo) return null;

  const accent = accentColor[phase as BannerPhase] || 'bg-slate-500';
  const isBusy = phase === 'downloading' || phase === 'preparing';
  const elapsed = phase === 'downloading' && downloadStartRef.current
    ? (Date.now() - downloadStartRef.current) / 1000
    : 0;
  const speed = updateProgress && elapsed > 0 ? updateProgress.downloaded / elapsed : 0;
  const pct = updateProgress && updateProgress.total > 0
    ? Math.round((updateProgress.downloaded / updateProgress.total) * 100)
    : 0;

  return (
    <div className={cn(
      "transition-all duration-300 ease-out overflow-hidden border-b border-slate-200",
      visible ? 'opacity-100' : 'opacity-0',
      expanded ? 'max-h-[400px]' : 'max-h-20'
    )}>
      <div className="flex flex-col bg-white text-slate-700">
        {/* Main bar */}
        <div className="flex items-center gap-3 px-4 py-4">
          {/* Left accent indicator */}
          <div className={cn("w-1.5 h-7 rounded-full shrink-0", accent)} />

          {/* Icon */}
          <span className={cn(
            "shrink-0",
            phase === 'failed' && 'text-red-500',
            phase === 'ready' && 'text-green-500',
            !['failed', 'ready'].includes(phase) && 'text-blue-500'
          )}>
            <PhaseIcon phase={phase as BannerPhase} />
          </span>

          {/* Label */}
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-base font-semibold">
              {phase === 'available' && (
                <>تحديث متوفر لـ Almowakeb</>
              )}
              {phase === 'downloading' && <>جاري تحميل التحديث...</>}
              {phase === 'preparing' && <>جاري تحضير التحديث للتثبيت...</>}
              {phase === 'ready' && <>التحديث جاهز للتثبيت</>}
              {phase === 'failed' && <span className="text-red-600">{error || 'فشل التحديث'}</span>}
            </span>
            {phase === 'available' && (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-slate-500 font-mono" dir="ltr">
                  v{updateInfo.current_version} → v{updateInfo.latest_version}
                </span>
                {updateInfo.download_url && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                      تحديث كامل
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {phase === 'available' && (
              <>
                {updateInfo.release_body && (
                  <button
                    onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                    className="inline-flex items-center gap-1.5 h-10 px-3 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    {showReleaseNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <span className="hidden sm:inline">ملاحظات الإصدار</span>
                  </button>
                )}
                <Button 
                  size="sm" 
                  onClick={startUpdate} 
                  className="h-10 px-5 text-sm gap-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  <Download className="w-4.5 h-4.5" />
                  تحديث الآن
                </Button>
              </>
            )}

            {phase === 'ready' && (
              <Button 
                size="sm" 
                onClick={restartToUpdate} 
                className="h-10 px-5 text-sm gap-2 rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white shadow-sm"
              >
                <RotateCcw className="w-4.5 h-4.5" />
                إعادة تشغيل
              </Button>
            )}

            {phase === 'failed' && (
              <Button 
                size="sm" 
                onClick={retry} 
                className="h-10 px-5 text-sm gap-2 rounded-lg font-semibold"
              >
                <RefreshCw className="w-4.5 h-4.5" />
                إعادة المحاولة
              </Button>
            )}

            {(phase === 'available' || phase === 'failed') && (
              <button 
                onClick={handleDismiss} 
                className="p-2.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" 
                title="تجاهل"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {isBusy && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-2.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="تفاصيل التحديث"
              >
                {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Release Notes */}
        {phase === 'available' && updateInfo.release_body && showReleaseNotes && (
          <div className="px-6 pb-4 pt-0 border-t border-slate-100">
            <div className="mt-3 p-4 bg-slate-50 rounded-lg text-slate-700">
              <h3 className="font-bold text-lg mb-3">ما الجديد في v{updateInfo.latest_version}</h3>
              <div className="text-sm whitespace-pre-wrap">
                {updateInfo.release_body}
              </div>
            </div>
          </div>
        )}

        {/* Expanded progress detail */}
        {expanded && isBusy && (
          <div className="px-8 pb-6 pt-2 border-t border-slate-100">
            <UpdateProgress
              phase={phase}
              percentage={pct}
              downloadedBytes={updateProgress?.downloaded || 0}
              totalBytes={updateProgress?.total || 0}
              speed={speed}
              error={error}
              compact={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
