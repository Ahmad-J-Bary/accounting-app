import { useEffect, useState } from "react";
import { ExternalLink, X, RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@shared/ui/button";
import { useUpdateChecker } from "../hooks/useUpdateChecker";
import { cn } from "@shared/lib/utils";

export function UpdateBanner() {
  const { updateInfo, check, dismiss, dismissAll, isUpdating, updateProgress, installUpdate, error } = useUpdateChecker();
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (updateInfo) {
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [updateInfo]);

  if (!updateInfo) return null;

  const handleDismiss = () => {
    if (isUpdating) return;
    setVisible(false);
    setTimeout(dismiss, 300);
  };

  const handleDismissAll = () => {
    if (isUpdating) return;
    setVisible(false);
    setTimeout(dismissAll, 300);
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-md w-full transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden">
        <div className="bg-gradient-to-l from-blue-600 to-blue-700 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white text-sm font-bold">تحديث متاح</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => check()}
              disabled={isUpdating}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="التحقق مرة أخرى"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDismiss}
              disabled={isUpdating}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="تجاهل هذا التحديث"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">
                {updateInfo.release_name}
              </p>
              <p className="text-xs text-slate-500">
                الإصدار الحالي: <span className="font-mono font-bold" dir="ltr">{updateInfo.current_version}</span>
                {" → "}
                <span className="font-mono font-bold text-blue-600" dir="ltr">{updateInfo.latest_version}</span>
              </p>
            </div>
          </div>

          {updateInfo.release_body && !isUpdating && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "إخفاء التفاصيل" : "عرض تفاصيل التحديث"}
            </button>
          )}

          {expanded && updateInfo.release_body && !isUpdating && (
            <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap font-mono">
              {updateInfo.release_body}
            </div>
          )}

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3 font-semibold leading-relaxed">
              فشل التحديث: {error}
            </div>
          )}

          {isUpdating ? (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold text-blue-600">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  جاري تنزيل وتثبيت التحديث...
                </span>
                <span>
                  {updateProgress && updateProgress.total > 0
                    ? `${Math.round((updateProgress.downloaded / updateProgress.total) * 100)}%`
                    : "..."}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{
                    width:
                      updateProgress && updateProgress.total > 0
                        ? `${(updateProgress.downloaded / updateProgress.total) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              {updateProgress && updateProgress.total > 0 && (
                <div className="text-[10px] text-slate-400 font-mono text-left" dir="ltr">
                  {(updateProgress.downloaded / (1024 * 1024)).toFixed(2)} MB / {(updateProgress.total / (1024 * 1024)).toFixed(2)} MB
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 text-xs font-bold gap-1.5"
                onClick={installUpdate}
              >
                <Download className="w-3.5 h-3.5" />
                تحديث الآن
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl h-9 text-xs text-slate-400 hover:text-slate-600"
                onClick={handleDismiss}
              >
                لاحقاً
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl h-9 text-xs text-slate-400 hover:text-slate-600 mr-auto"
                onClick={handleDismissAll}
              >
                تجاهل الكل
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
