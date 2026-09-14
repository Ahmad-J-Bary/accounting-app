import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
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
  const [selecting, setSelecting] = useState(false);

  const handleSelect = (lang: AppLanguage) => {
    setSelecting(true);
    onComplete(lang);
  };

  const arSelected = (initialLanguage ?? "ar") === "ar";
  const enSelected = (initialLanguage ?? "ar") === "en";

  return (
    <div dir="rtl" className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-blue-600/20">
            <Globe className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-1">اختر اللغة</h1>
          <p className="text-sm text-slate-400 font-medium">Choose Language</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleSelect("ar")}
            disabled={selecting}
            className={`w-full group relative flex items-center justify-center gap-3 h-16 rounded-2xl border-2 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
              arSelected
                ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-600/10"
                : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            {selecting ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <span className="text-2xl">🇸🇦</span>
            )}
            <span className="font-bold text-lg text-slate-800">العربية</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelect("en")}
            disabled={selecting}
            className={`w-full group relative flex items-center justify-center gap-3 h-16 rounded-2xl border-2 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
              enSelected
                ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-600/10"
                : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            {selecting ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <span className="text-2xl">🇬🇧</span>
            )}
            <span className="font-bold text-lg text-slate-800">English</span>
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-300 mt-8">
          You can change this later in Settings
        </p>
      </div>
    </div>
  );
}
