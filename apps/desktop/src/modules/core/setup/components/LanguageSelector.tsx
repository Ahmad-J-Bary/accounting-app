import { useState } from "react";
import { Globe, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import {
  DIRECTION_BY_LANGUAGE,
  getNestedTranslation,
} from "@shared/i18n/resources";
import { setup } from "@shared/i18n/resources/setup";
import type { AppLanguage } from "@shared/types/i18n";
import { StartupWindowShell } from "@app/shell/StartupWindowShell";

interface LanguageSelectorProps {
  /** Initial VISUAL default — never auto-persisted. The user must
   * explicitly choose before anything is saved to localStorage. */
  initialLanguage?: AppLanguage | null;
  onComplete: (lang: AppLanguage) => void;
}

export function LanguageSelector({
  initialLanguage = null,
  onComplete,
}: LanguageSelectorProps) {
  const [selected, setSelected] = useState<AppLanguage>(initialLanguage ?? "ar");
  const [committing, setCommitting] = useState(false);

  const handleNext = () => {
    setCommitting(true);
    onComplete(selected);
  };

  const direction = DIRECTION_BY_LANGUAGE[selected];
  const isRtl = direction === "rtl";
  const text = (key: string, fallback: string) =>
    getNestedTranslation(setup[selected], key) ?? fallback;

  return (
    <StartupWindowShell
      title={text("language.title", "اختر اللغة")}
      subtitle={text("language.subtitle", "Choose Language")}
      direction={direction}
    >
      <div dir={direction} className="flex min-h-full w-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
              <Globe className="h-8 w-8" />
            </div>
            <h1 className="mb-1 text-2xl font-black text-foreground">{text("language.title", "اختر اللغة")}</h1>
            <p className="text-sm font-medium text-muted-foreground">{text("language.subtitle", "Choose Language")}</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelected("ar")}
              disabled={committing}
              className={`group relative flex h-16 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                selected === "ar"
                  ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                  : "border-border bg-card hover:border-primary/80 hover:bg-primary/10"
              }`}
            >
              <span className="text-2xl">🇸🇦</span>
              <span className="text-lg font-bold text-foreground">{text("language.arabic", "العربية")}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelected("en")}
              disabled={committing}
              className={`group relative flex h-16 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                selected === "en"
                  ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                  : "border-border bg-card hover:border-primary/80 hover:bg-primary/10"
              }`}
            >
              <span className="text-2xl">🇬🇧</span>
              <span className="text-lg font-bold text-foreground">{text("language.english", "English")}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={committing}
            className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/80 hover:shadow-xl hover:shadow-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {committing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                {text("language.continue", isRtl ? "التالي" : "Next")}
                {isRtl ? (
                  <ArrowLeft className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </>
            )}
          </button>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            {text("language.changeLaterHint", "You can change this later in Settings")}
          </p>
        </div>
      </div>
    </StartupWindowShell>
  );
}
