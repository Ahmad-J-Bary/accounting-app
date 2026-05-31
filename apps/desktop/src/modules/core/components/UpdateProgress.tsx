import { RefreshCw } from "lucide-react";

interface UpdateProgressProps {
  progress: { downloaded: number; total: number } | null;
}

export function UpdateProgress({ progress }: UpdateProgressProps) {
  const percentage = progress && progress.total > 0
    ? Math.round((progress.downloaded / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold text-blue-600">
        <span className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          جاري تنزيل وتثبيت التحديث...
        </span>
        <span>{percentage > 0 ? `${percentage}%` : "..."}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-blue-600 h-full transition-all duration-300 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {progress && progress.total > 0 && (
        <div className="text-[10px] text-slate-400 font-mono text-left" dir="ltr">
          {(progress.downloaded / (1024 * 1024)).toFixed(2)} MB / {(progress.total / (1024 * 1024)).toFixed(2)} MB
        </div>
      )}
    </div>
  );
}
