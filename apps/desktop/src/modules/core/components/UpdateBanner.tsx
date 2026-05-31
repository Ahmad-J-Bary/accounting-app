import { useEffect, useState } from "react";
import { ExternalLink, X, RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@shared/ui/button";
import { useUpdateChecker } from "../hooks/useUpdateChecker";
import { cn } from "@shared/lib/utils";
import { UpdateProgress } from "./UpdateProgress";

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
                الإصدار الحالي:{" "}
                <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-700" dir="ltr">
                  <span>{updateInfo.current_version}</span>
                  <span className="text-slate-400 mx-0.5">→</span>
                  <span className="text-blue-600">{updateInfo.latest_version}</span>
                </span>
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
            <UpdateProgress progress={updateProgress} />
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
