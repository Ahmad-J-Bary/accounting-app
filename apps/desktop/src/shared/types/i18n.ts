export type AppLanguage = "ar" | "en";

export type AppDirection = "rtl" | "ltr";

export type I18nNamespace =
  | "common"
  | "shell"
  | "search"
  | "commands"
  | "voice"
  | "settings";

export interface TranslationTree {
  [key: string]: string | TranslationTree;
}

export interface TerminologyOverride {
  key: string;
  language: AppLanguage;
  value: string;
}

export interface LocalizationContextValue {
  language: AppLanguage;
  direction: AppDirection;
  locale: string;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, options?: { namespace?: I18nNamespace; fallback?: string }) => string;
  resolveLabel: (key: string, fallback?: string) => string;
  terminologyOverrides: TerminologyOverride[];
  setTerminologyOverride: (override: TerminologyOverride) => void;
  removeTerminologyOverride: (key: string, language: AppLanguage) => void;
}
