import { cn } from "@shared/lib/utils";
import { Check, Loader2, X } from "lucide-react";

interface Step {
  key: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}

export type UpdateProgressPhase = 'downloading' | 'preparing' | 'ready' | 'failed';

interface UpdateProgressProps {
  percentage?: number;
  downloaded?: number;
  total?: number;
  phase: UpdateProgressPhase;
  error?: string | null;
  compact?: boolean;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

const steps: Step[] = [
  { key: 'download', label: 'تحميل', status: 'pending' },
  { key: 'prepare', label: 'تحضير', status: 'pending' },
  { key: 'restart', label: 'إعادة تشغيل', status: 'pending' },
];

function stepStatus(phase: UpdateProgressProps['phase'], stepIndex: number): Step['status'] {
  if (phase === 'failed') return stepIndex === 0 ? 'failed' : 'pending';
  
  const order: UpdateProgressPhase[] = ['downloading', 'preparing', 'ready'];
  const currentIdx = order.indexOf(phase);
  
  if (currentIdx === -1) return 'pending';
  
  if (stepIndex < currentIdx) return 'done';
  if (stepIndex === currentIdx) return 'active';
  if (phase === 'ready' && stepIndex === 2) return 'done';
  return 'pending';
}

export function UpdateProgress({ 
  percentage = 0, 
  downloaded = 0, 
  total = 0, 
  phase, 
  error, 
  compact = false 
}: UpdateProgressProps) {
  return (
    <div className={cn("space-y-3", compact && "space-y-2")} dir="rtl">
      {/* Steps row */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => {
          const status = stepStatus(phase, i);
          return (
            <div key={s.key} className="flex-1 flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300",
                  status === 'done' && "bg-green-500",
                  status === 'active' && !compact && "bg-blue-500 ring-2 ring-blue-100",
                  status === 'active' && compact && "bg-blue-500",
                  status === 'failed' && "bg-red-500",
                  status === 'pending' && "bg-slate-200",
                )}>
                  {status === 'done' && <Check className="w-3.5 h-3.5 text-white" />}
                  {status === 'active' && <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />}
                  {status === 'failed' && <X className="w-3.5 h-3.5 text-white" />}
                  {status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
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
                  status === 'done' || (status === 'active' && phase === 'downloading') ? "bg-green-400" : "bg-slate-200",
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar during download */}
      {phase === 'downloading' && total > 0 && (
        <div className={cn("space-y-2", compact && "space-y-1")}>
          <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${percentage}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-500 font-mono" dir="ltr">
            <span>{formatMB(downloaded)} / {formatMB(total)} MB</span>
            <span className="font-semibold text-blue-600">{percentage}%</span>
          </div>
        </div>
      )}

      {/* Preparing state message */}
      {phase === 'preparing' && (
        <div className="text-center text-xs text-slate-600">
          جاري تحضير التحديث...
        </div>
      )}

      {/* Ready state message */}
      {phase === 'ready' && (
        <div className="text-center text-xs text-green-600 font-medium">
          التحديث جاهز! اضغط إعادة تشغيل لتطبيقه
        </div>
      )}

      {/* Error state */}
      {phase === 'failed' && error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
