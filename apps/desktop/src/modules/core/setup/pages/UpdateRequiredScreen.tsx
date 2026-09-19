import { AlertTriangle, RefreshCw } from "lucide-react";
import { isValidLanguage } from "@shared/types/i18n";
import { I18N_RESOURCES } from "@shared/i18n/resources";
import type { StartupBlockInfo } from "@modules/core/api/backupService";
import { StartupWindowShell } from "@app/shell/StartupWindowShell";

interface Props {
  block: StartupBlockInfo;
}

function getStoredLang(): "ar" | "en" {
  if (typeof window === "undefined") return "ar";
  const stored = window.localStorage.getItem("erp_language");
  return isValidLanguage(stored) ? stored : "ar";
}

function t(key: string): string {
  const lang = getStoredLang();
  const bundle = I18N_RESOURCES[lang].setup as Record<string, Record<string, string>>;
  const parts = key.split(".");
  let current: unknown = bundle;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === "string" ? current : key;
}

export default function UpdateRequiredScreen({ block }: Props) {
  const dir = getStoredLang() === "en" ? "ltr" : "rtl";

  return (
    <StartupWindowShell
      title={t("updateRequired.title")}
      subtitle={t("updateRequired.description")}
      direction={dir}
    >
      <div dir={dir} className="flex min-h-full w-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-black text-slate-800 mb-2">{t("updateRequired.title")}</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          {t("updateRequired.description")}
        </p>
        <div className="flex items-center justify-center gap-4 rounded-xl bg-slate-50 border border-slate-100 p-4 mb-6 text-sm font-bold text-slate-700">
          <span>
            {t("updateRequired.dbVersion")} <span dir="ltr" className="font-mono">{block.found_version}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            {t("updateRequired.appVersion")} <span dir="ltr" className="font-mono">{block.supported_version}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 justify-center text-xs text-slate-400 font-bold">
          <RefreshCw className="w-4 h-4" />
          {t("updateRequired.instruction")}
        </div>
      </div>
      </div>
    </StartupWindowShell>
  );
}
