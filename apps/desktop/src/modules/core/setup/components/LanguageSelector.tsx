import { useState } from "react";
import { Globe, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import type { AppLanguage } from "@shared/types/i18n";

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

  const isRtl = selected === "ar";

  return (
    <div dir="rtl" className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center mb-5 shadow-lg shadow-primary/20">
            <Globe className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-1">اختر اللغة</h1>
          <p className="text-sm text-muted-foreground font-medium">Choose Language</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSelected("ar")}
            disabled={committing}
            className={`w-full group relative flex items-center justify-center gap-3 h-16 rounded-2xl border-2 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
              selected === "ar"
                ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                : "border-border bg-card hover:border-primary/80 hover:bg-primary/10"
            }`}
          >
            <span className="text-2xl">🇸🇦</span>
            <span className="font-bold text-lg text-foreground">العربية</span>
          </button>

          <button
            type="button"
            onClick={() => setSelected("en")}
            disabled={committing}
            className={`w-full group relative flex items-center justify-center gap-3 h-16 rounded-2xl border-2 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
              selected === "en"
                ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                : "border-border bg-card hover:border-primary/80 hover:bg-primary/10"
            }`}
          >
            <span className="text-2xl">🇬🇧</span>
            <span className="font-bold text-lg text-foreground">English</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={committing}
          className="w-full mt-6 h-12 rounded-2xl bg-primary hover:bg-primary/80 text-white font-bold text-base transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
        >
          {committing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {isRtl ? "التالي" : "Next"}
              {isRtl ? (
                <ArrowLeft className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          You can change this later in Settings
        </p>
      </div>
    </div>
  );
}
