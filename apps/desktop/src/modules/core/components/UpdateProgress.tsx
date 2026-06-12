import { cn } from "@shared/lib/utils";
import { Check, Loader2, X, Activity } from "lucide-react";
import type { UpdatePhase } from "../update/types";

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
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function formatKBps(bytesPerSec: number): string {
  const kbPerSec = bytesPerSec / 1024;
  if (kbPerSec > 1000) {
    return (kbPerSec / 1024).toFixed(1) + ' MB/s';
  }
  return kbPerSec.toFixed(0) + ' KB/s';
}

const steps: Step[] = [
  { key: 'download', label: 'تحميل', status: 'pending' },
  { key: 'verify', label: 'التحقق', status: 'pending' },
  { key: 'prepare', label: 'تحضير', status: 'pending' },
  { key: 'restart', label: 'إعادة تشغيل', status: 'pending' },
];

function stepStatus(phase: UpdatePhase, stepIndex: number): Step['status'] {
  if (phase === 'failed') return stepIndex === 0 ? 'failed' : 'pending';
  
  const order: UpdatePhase[] = ['checking', 'downloading', 'verifying', 'preparing', 'ready'];
  const currentIdx = order.indexOf(phase);
  
  if (currentIdx === -1) return 'pending';
  
  const stepMap: Record<string, number> = { download: 0, verify: 1, prepare: 2, restart: 3 };
  
  if (stepIndex < Object.values(stepMap).findIndex(i => i >= currentIdx - 1)) return 'done';
  if (stepIndex === Object.values(stepMap).findIndex(i => i >= currentIdx - 1)) return 'active';
  if (phase === 'ready' && stepIndex === 3) return 'done';
  return 'pending';
}

export function UpdateProgress({ 
  percentage = 0, 
  downloadedBytes = 0, 
  totalBytes = 0, 
  speed = 0, 
  phase, 
  error, 
  compact = false 
}: UpdateProgressProps) {
  return (
    <div className={cn("space-y-4", compact && "space-y-2")} dir="rtl">
      {/* Steps row */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => {
          const status = stepStatus(phase, i);
          return (
            <div key={s.key} className="flex-1 flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300",
                  status === 'done' && "bg-green-500",
                  status === 'active' && !compact && "bg-blue-500 ring-2 ring-blue-100",
                  status === 'active' && compact && "bg-blue-500",
                  status === 'failed' && "bg-red-500",
                  status === 'pending' && "bg-slate-200",
                )}>
                  {status === 'done' && <Check className="w-4 h-4 text-white" />}
                  {status === 'active' && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                  {status === 'failed' && <X className="w-4 h-4 text-white" />}
                  {status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-400" />}
                </div>
                {!compact && (
                  <span className={cn(
                    "text-xs font-medium",
                    status === 'done' && "text-green-600",
                    status === 'active' && "text-blue-600",
                    status === 'failed' && "text-red-600",
                    status === 'pending' && "text-slate-400",
                  )}>
                    {s.label}
                  </span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  "flex-1 h-px transition-colors duration-300",
                  status === 'done' ? "bg-green-400" : "bg-slate-200",
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar & details */}
      {phase === 'downloading' && totalBytes > 0 && (
        <div className="space-y-2">
          <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-300" 
              style={{ width: `${percentage}%` }} 
            />
          </div>
          <div className="flex justify-between text-xs text-slate-600 font-mono" dir="ltr">
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3" />
              <span>{formatMB(downloadedBytes)} / {formatMB(totalBytes)} MB</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{speed > 0 ? formatKBps(speed) : ''}</span>
              <span className="font-semibold text-blue-700">{percentage}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Phase-specific messages */}
      {phase === 'checking' && (
        <div className="text-center text-sm text-slate-600">جاري التحقق من التحديثات...</div>
      )}
      {phase === 'verifying' && (
        <div className="text-center text-sm text-slate-600">جاري التحقق من سلامة الملفات...</div>
      )}
      {phase === 'preparing' && (
        <div className="text-center text-sm text-slate-600">جاري تحضير التحديث للتطبيق...</div>
      )}
      {phase === 'ready' && (
        <div className="text-center text-sm text-green-700 font-medium">
          التحديث جاهز! اضغط على زر "إعادة تشغيل" لتطبيقه
        </div>
      )}

      {/* Error state */}
      {phase === 'failed' && error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <div className="font-semibold mb-1">حدث خطأ أثناء التحديث</div>
          <div>{error}</div>
        </div>
      )}
    </div>
  );
}
