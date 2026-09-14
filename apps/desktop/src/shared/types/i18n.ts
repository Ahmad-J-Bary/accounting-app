export type AppLanguage = "ar" | "en";

export type AppDirection = "rtl" | "ltr";

export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ["ar", "en"];

export type I18nNamespace =
  | "common"
  | "shell"
  | "search"
  | "commands"
  | "voice"
  | "dashboard"
  | "accounting"
  | "partners"
  | "invoicing"
  | "inventory"
  | "fixedAssets"
  | "reports"
  | "settings"
  | "users"
  | "auth"
  | "validation"
  | "errors"
  | "widgets"
  | "openingBalance";

export interface TranslationTree {
  [key: string]: string | TranslationTree;
}

export interface TerminologyOverride {
  key: string;
  language: AppLanguage;
  value: string;
}

export interface TranslateOptions {
  namespace?: I18nNamespace;
  fallback?: string;
  vars?: Record<string, string | number>;
  count?: number;
}

export function isValidLanguage(value: unknown): value is AppLanguage {
  return value === "ar" || value === "en";
}

export interface LocalizationContextValue {
  language: AppLanguage;
  direction: AppDirection;
  isRTL: boolean;
  locale: string;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, options?: TranslateOptions) => string;
  resolveLabel: (key: string, fallback?: string) => string;
  terminologyOverrides: TerminologyOverride[];
  setTerminologyOverride: (override: TerminologyOverride) => void;
  removeTerminologyOverride: (key: string, language: AppLanguage) => void;
}