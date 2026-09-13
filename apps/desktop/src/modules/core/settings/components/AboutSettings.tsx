import { Info, RefreshCw, Download, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@shared/ui/button";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import { useUpdate } from "@modules/core/update/context/UpdateContext";
import { UpdateProgress } from "../../update/components/UpdateProgress";
import { useLocalization } from "@app/providers/LocalizationProvider";
import pkg from "../../../../../package.json";

export function AboutSettings() {
  const {
    updateInfo,
    loading: updateLoading,
    isUpdating,
    updateProgress,
    error: updateError,
    check: handleCheckUpdate,
    installUpdate,
    restartToUpdate,
    retry,
    phase,
  } = useUpdate();
  const { t } = useLocalization();

  return (
    <SettingsSection title={t("settings.about.title", { namespace: "settings", fallback: "حول التطبيق" })} description={t("settings.about.description", { namespace: "settings", fallback: "معلومات الإصدار والتحقق من التحديثات." })}>
      <div className="space-y-6">
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Info className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">{t("settings.about.appName", { namespace: "settings", fallback: "المُواكب" })}</h3>
              <p className="text-sm text-slate-500">{t("settings.about.appTagline", { namespace: "settings", fallback: "نظام إدارة المنشآت" })}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">{t("settings.about.currentVersion", { namespace: "settings", fallback: "الإصدار الحالي" })}</span>
              <p className="font-black text-slate-800 font-mono" dir="ltr">{pkg.version}</p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">{t("settings.about.latestVersion", { namespace: "settings", fallback: "آخر إصدار متاح" })}</span>
              <p className="font-black text-slate-800 font-mono" dir="ltr">
                {updateInfo?.latest_version === "فشل الاتصال" ? "—" : (updateInfo?.latest_version || "—")}
              </p>
            </div>
          </div>

          {phase === "ready" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-emerald-700 text-center">{t("settings.about.readyToInstall", { namespace: "settings", fallback: "التحديث جاهز للتثبيت" })}</p>
              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 text-xs font-bold gap-1.5"
                onClick={restartToUpdate}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t("settings.about.restartAndInstall", { namespace: "settings", fallback: "إعادة التشغيل والتثبيت" })}
              </Button>
            </div>
          )}

          {phase === "failed" && (
            <div className="space-y-2">
              {updateError && (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3.5 font-bold">
                  {t("settings.about.updateError", { namespace: "settings", fallback: "خطأ في التحديث: {{error}}", vars: { error: updateError } })}
                </div>
              )}
              <Button
                size="sm"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-9 text-xs font-bold gap-1.5"
                onClick={retry}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t("settings.about.retry", { namespace: "settings", fallback: "إعادة المحاولة" })}
              </Button>
            </div>
          )}

          {updateError && phase !== "failed" && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3.5 font-bold">
              {t("settings.about.updateError", { namespace: "settings", fallback: "خطأ في التحديث: {{error}}", vars: { error: updateError } })}
            </div>
          )}

          {!isUpdating && phase !== "ready" && phase !== "failed" && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 text-sm font-bold gap-2"
              onClick={handleCheckUpdate}
              disabled={updateLoading}
            >
              {updateLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {updateLoading ? t("settings.about.checking", { namespace: "settings", fallback: "جاري التحقق..." }) : t("settings.about.checkForUpdate", { namespace: "settings", fallback: "التحقق من وجود تحديث" })}
            </Button>
          )}

          {isUpdating && <UpdateProgress progress={updateProgress} phase={phase} />}

          {updateInfo && updateInfo.has_update && phase === "available" && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-green-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {t("settings.about.updateAvailable", { namespace: "settings", fallback: "يتوفر تحديث جديد! ({{version}})", vars: { version: updateInfo.latest_version } })}
              </p>
              {updateInfo.release_body && (
                <div className="text-xs text-green-700 bg-white rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                  {updateInfo.release_body}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-9 text-xs font-bold gap-1.5"
                  onClick={installUpdate}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t("settings.about.updateNow", { namespace: "settings", fallback: "تحديث الآن" })}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-9 text-xs text-slate-500"
                  onClick={() => window.open("https://github.com/Ahmad-J-Bary/accounting-app/releases", "_blank")}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t("settings.about.allReleases", { namespace: "settings", fallback: "كل الإصدارات" })}
                </Button>
              </div>
            </div>
          )}

          {updateInfo && !updateInfo.has_update && !isUpdating && updateInfo.latest_version !== "فشل الاتصال" && (
            <div className="bg-slate-100 rounded-xl p-4">
              <p className="text-sm font-bold text-slate-600">{t("settings.about.upToDate", { namespace: "settings", fallback: "أنت تستخدم أحدث إصدار ✅" })}</p>
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
