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
    <SettingsSection title={t("about.title", { namespace: "settings" })} description={t("about.description", { namespace: "settings" })}>
      <div className="space-y-5 sm:space-y-6">
        <div className="bg-muted/50 rounded-2xl p-4 sm:p-6 border border-border space-y-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <Info className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-foreground">{t("about.appName", { namespace: "settings" })}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{t("about.appTagline", { namespace: "settings" })}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium">{t("about.currentVersion", { namespace: "settings" })}</span>
              <p className="font-black text-foreground font-mono" dir="ltr">{pkg.version}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium">{t("about.latestVersion", { namespace: "settings" })}</span>
              <p className="font-black text-foreground font-mono" dir="ltr">
                {updateInfo?.latest_version === "فشل الاتصال" ? "—" : (updateInfo?.latest_version || "—")}
              </p>
            </div>
          </div>

          {phase === "ready" && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 sm:p-4 space-y-3">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 text-center">{t("about.readyToInstall", { namespace: "settings" })}</p>
              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 text-xs font-bold gap-1.5"
                onClick={restartToUpdate}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t("about.restartAndInstall", { namespace: "settings" })}
              </Button>
            </div>
          )}

          {phase === "failed" && (
            <div className="space-y-2">
              {updateError && (
                <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl p-3 sm:p-3.5 font-bold">
                  {t("about.updateError", { namespace: "settings", vars: { error: updateError } })}
                </div>
              )}
              <Button
                size="sm"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-9 text-xs font-bold gap-1.5"
                onClick={retry}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t("about.retry", { namespace: "settings" })}
              </Button>
            </div>
          )}

          {updateError && phase !== "failed" && (
            <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl p-3 sm:p-3.5 font-bold">
              {t("about.updateError", { namespace: "settings", vars: { error: updateError } })}
            </div>
          )}

          {!isUpdating && phase !== "ready" && phase !== "failed" && (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 sm:h-10 text-xs sm:text-sm font-bold gap-2"
              onClick={handleCheckUpdate}
              disabled={updateLoading}
            >
              {updateLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {updateLoading ? t("about.checking", { namespace: "settings" }) : t("about.checkForUpdate", { namespace: "settings" })}
            </Button>
          )}

          {isUpdating && <UpdateProgress progress={updateProgress} phase={phase} />}

          {updateInfo && updateInfo.has_update && phase === "available" && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 sm:p-4 space-y-3">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                {t("about.updateAvailable", { namespace: "settings", vars: { version: updateInfo.latest_version } })}
              </p>
              {updateInfo.release_body && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 bg-card rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                  {updateInfo.release_body}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 text-xs font-bold gap-1.5"
                  onClick={installUpdate}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t("about.updateNow", { namespace: "settings" })}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-9 text-xs text-muted-foreground"
                  onClick={() => window.open("https://github.com/Ahmad-J-Bary/accounting-app/releases", "_blank")}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t("about.allReleases", { namespace: "settings" })}
                </Button>
              </div>
            </div>
          )}

          {updateInfo && !updateInfo.has_update && !isUpdating && updateInfo.latest_version !== "فشل الاتصال" && (
            <div className="bg-muted rounded-xl p-3 sm:p-4">
              <p className="text-sm font-bold text-muted-foreground">{t("about.upToDate", { namespace: "settings" })}</p>
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
