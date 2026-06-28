import { cn } from "@shared/lib/utils";
import { Check, Loader2, X, Activity, HardDrive } from "lucide-react";
import type { UpdatePhase } from "../hooks/useUpdateChecker";

interface Step {
  key: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}

interface UpdateProgressProps {
  percentage?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speed?: number; // bytes per second
  phase: UpdatePhase;
  error?: string | null;
  compact?: boolean;
  progress?: { downloaded: number; total: number } | null;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function formatSpeed(bytesPerSec: number): string {
  const kbPerSec = bytesPerSec / 1024;
  if (kbPerSec > 1000) {
    return (kbPerSec / 1024).toFixed(1) + ' MB/ث';
  }
  return kbPerSec.toFixed(0) + ' KB/ث';
}

const steps: Step[] = [
  { key: 'download', label: 'تحميل التحديث', status: 'pending' },
  { key: 'verify', label: 'التحقق من التوقيع', status: 'pending' },
  { key: 'prepare', label: 'تحضير الملفات', status: 'pending' },
  { key: 'restart', label: 'إعادة التشغيل', status: 'pending' },
];

function stepStatus(phase: UpdatePhase, stepIndex: number): Step['status'] {
  if (phase === 'failed') return stepIndex === 0 ? 'failed' : 'pending';
  
  // Mapping phase to steps index
  // downloading -> step 0 (download)
  // preparing -> step 2 (prepare) (since verify is fast/internal)
  // ready -> step 3 (ready to restart)
  
  if (phase === 'downloading') {
    return stepIndex === 0 ? 'active' : 'pending';
  }
  if (phase === 'preparing') {
    if (stepIndex < 2) return 'done';
    if (stepIndex === 2) return 'active';
    return 'pending';
  }
  if (phase === 'ready') {
    if (stepIndex < 3) return 'done';
    return 'active';
  }
  return 'pending';
}

export function UpdateProgress({ 
  percentage = 0, 
  downloadedBytes = 0, 
  totalBytes = 0, 
  speed = 0, 
  phase, 
  error, 
  compact = false,
  progress,
}: UpdateProgressProps) {
  const pct = progress && progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : percentage;
  const dlBytes = progress?.downloaded ?? downloadedBytes;
  const tlBytes = progress?.total ?? totalBytes;

  if (compact) {
    // Compact Inline UI for Banner Integration
    return (
      <div className="w-full flex flex-col gap-1.5" dir="rtl">
        {/* Progress Info Row */}
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-mono">
            {phase === 'downloading' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                <span>{formatMB(dlBytes)} / {formatMB(tlBytes)} MB</span>
                {speed > 0 && <span className="opacity-60">({formatSpeed(speed)})</span>}
              </>
            )}
            {phase === 'preparing' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                <span>جاري استخراج وتحضير ملفات التثبيت...</span>
              </>
            )}
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-200">{pct}%</span>
        </div>

        {/* Mini progress bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-out",
              phase === 'preparing' ? "bg-amber-500 animate-pulse w-full" : "bg-blue-600"
            )} 
            style={{ width: phase === 'preparing' ? '100%' : `${pct}%` }} 
          />
        </div>
      </div>
    );
  }

  // Full Expanded UI (for about settings dialog or full panels)
  return (
    <div className="w-full space-y-5 py-2" dir="rtl">
      {/* Visual Steps Tracker */}
      <div className="grid grid-cols-4 gap-2 relative">
        {steps.map((s, i) => {
          const status = stepStatus(phase, i);
          return (
            <div key={s.key} className="flex flex-col items-center text-center relative z-10">
              {/* Step indicator circle */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-350 shadow-sm",
                status === 'done' && "bg-emerald-500 border-emerald-500 text-white",
                status === 'active' && "bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/30",
                status === 'failed' && "bg-rose-500 border-rose-500 text-white",
                status === 'pending' && "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400"
              )}>
                {status === 'done' && <Check className="w-4 h-4 stroke-[3]" />}
                {status === 'active' && <Loader2 className="w-4 h-4 animate-spin" />}
                {status === 'failed' && <X className="w-4 h-4" />}
                {status === 'pending' && <span className="text-xs font-bold font-mono">{i + 1}</span>}
              </div>
              
              {/* Label */}
              <span className={cn(
                "text-xs font-semibold mt-2 transition-colors duration-300",
                status === 'done' && "text-emerald-600 dark:text-emerald-400",
                status === 'active' && "text-blue-600 dark:text-blue-400",
                status === 'failed' && "text-rose-600 dark:text-rose-400",
                status === 'pending' && "text-slate-400 dark:text-slate-500",
              )}>
                {s.label}
              </span>
            </div>
          );
        })}
        
        {/* Connecting line background */}
        <div className="absolute top-4 left-[12.5%] right-[12.5%] h-0.5 bg-slate-100 dark:bg-slate-800 -z-0" />
      </div>

      {/* Main progress details */}
      {phase === 'downloading' && tlBytes > 0 && (
        <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-100 dark:border-slate-800 rounded-xl">
          <div className="flex justify-between items-center text-xs font-medium text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-blue-500" />
              تم تحميل {formatMB(dlBytes)} ميجابايت من أصل {formatMB(tlBytes)} ميجابايت
            </span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{pct}%</span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-200 ease-out" 
              style={{ width: `${pct}%` }} 
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-400" />
              سرعة النقل الحالية
            </span>
            <span className="font-bold text-slate-700 dark:text-slate-350">{speed > 0 ? formatSpeed(speed) : 'اتصال نشط...'}</span>
          </div>
        </div>
      )}

      {/* Phase status messages */}
      {phase === 'preparing' && (
        <div className="p-4 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20 rounded-xl text-center text-sm text-amber-700 dark:text-amber-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          <span>جاري استخراج الملفات وتحضير الحزمة لتثبيت التحديث...</span>
        </div>
      )}

      {phase === 'ready' && (
        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl text-center text-sm text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-2 font-medium">
          <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
          <span>جاهز لتطبيق التحديث! انقر فوق "إعادة التشغيل" للمتابعة.</span>
        </div>
      )}

      {/* Error container */}
      {phase === 'failed' && error && (
        <div className="text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/20 rounded-xl px-4 py-3">
          <div className="font-bold mb-1 flex items-center gap-1.5">
            <X className="w-4 h-4 text-rose-500" />
            فشلت عملية التحديث
          </div>
          <div className="text-xs opacity-90 leading-relaxed">{error}</div>
        </div>
      )}
    </div>
  );
}
