import { AlertTriangle, RefreshCw } from "lucide-react";

type ReportErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export function ReportErrorState({ message = "تعذر تحميل بيانات التقرير", onRetry }: ReportErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <AlertTriangle className="mb-3 h-12 w-12 text-rose-500" />
      <p className="text-sm font-bold">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-100"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}