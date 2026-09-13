import { AlertTriangle, RefreshCw } from "lucide-react";
import { useLocalization } from "@app/providers/LocalizationProvider";

type ReportErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export function ReportErrorState({ message, onRetry }: ReportErrorStateProps) {
  const { t } = useLocalization();
  const resolvedMessage = message ?? t('states.error', { fallback: 'تعذر تحميل بيانات التقرير' });
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <AlertTriangle className="mb-3 h-12 w-12 text-rose-500" />
      <p className="text-sm font-bold">{resolvedMessage}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-100"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('actions.retry', { fallback: 'إعادة المحاولة' })}
        </button>
      )}
    </div>
  );
}