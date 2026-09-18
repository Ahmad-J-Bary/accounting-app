import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  DIRECTION_BY_LANGUAGE,
  DEFAULT_LANGUAGE,
  I18N_RESOURCES,
  LOCALE_BY_LANGUAGE,
  getNestedTranslation,
  interpolate,
  pluralCategory,
} from "@shared/i18n/resources";
import type {
  AppLanguage,
  LocalizationContextValue,
  TerminologyOverride,
} from "@shared/types/i18n";
import { isValidLanguage } from "@shared/types/i18n";
import { setDirection, setLocale } from "@shared/lib/format";

const LANGUAGE_STORAGE_KEY = "erp_language";
const TERMINOLOGY_STORAGE_KEY = "erp_terminology_overrides";

const SAFE_FALLBACK_VALUE: LocalizationContextValue = {
  language: DEFAULT_LANGUAGE,
  direction: DIRECTION_BY_LANGUAGE[DEFAULT_LANGUAGE],
  isRTL: DIRECTION_BY_LANGUAGE[DEFAULT_LANGUAGE] === "rtl",
  locale: LOCALE_BY_LANGUAGE[DEFAULT_LANGUAGE],
  setLanguage: () => {},
  t: (key, options) => options?.fallback ?? key,
  resolveLabel: (key: string, fallback?: string) => fallback ?? key,
  setTerminologyOverride: () => {},
  removeTerminologyOverride: () => {},
  terminologyOverrides: [],
};

const LocalizationContext = createContext<LocalizationContextValue>(SAFE_FALLBACK_VALUE);

// eslint-disable-next-line react-refresh/only-export-components
export function applyDocumentAttributes(language: AppLanguage) {
  const direction = DIRECTION_BY_LANGUAGE[language];
  const locale = LOCALE_BY_LANGUAGE[language];
  document.documentElement.lang = language;
  document.documentElement.dir = direction;
  setLocale(locale);
  setDirection(direction);
}

function loadLanguage(): AppLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isValidLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

function loadTerminologyOverrides(): TerminologyOverride[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TERMINOLOGY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TerminologyOverride[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(loadLanguage);
  const [terminologyOverrides, setTerminologyOverrides] = useState<TerminologyOverride[]>(loadTerminologyOverrides);

  const direction = DIRECTION_BY_LANGUAGE[language];
  const locale = LOCALE_BY_LANGUAGE[language];

  useLayoutEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    applyDocumentAttributes(language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(TERMINOLOGY_STORAGE_KEY, JSON.stringify(terminologyOverrides));
  }, [terminologyOverrides]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
  }, []);

  const resolveLabel = useCallback(
    (key: string, fallback?: string) => {
      const override = terminologyOverrides.find(
        (item) => item.key === key && item.language === language,
      );
      return override?.value || fallback || key;
    },
    [language, terminologyOverrides],
  );

  const t = useCallback<LocalizationContextValue["t"]>(
    (key, options) => {
      const namespace = options?.namespace ?? "common";
      const bundle = I18N_RESOURCES[language][namespace];
      let candidate = key;
      if (options?.count !== undefined) {
        const withCount = `${key}.${pluralCategory(language, options.count)}`;
        if (getNestedTranslation(bundle, withCount) !== undefined) candidate = withCount;
      }
      const translated = getNestedTranslation(bundle, candidate);
      const resolved = resolveLabel(
        `${namespace}.${candidate}`,
        translated || options?.fallback || key,
      );
      const vars = {
        ...(options?.count !== undefined ? { count: options.count } : {}),
        ...options?.vars,
      };
      return interpolate(resolved, vars);
    },
    [language, resolveLabel],
  );

  const setTerminologyOverride = useCallback((override: TerminologyOverride) => {
    setTerminologyOverrides((current) => {
      const others = current.filter(
        (item) => !(item.key === override.key && item.language === override.language),
      );
      return [...others, override];
    });
  }, []);

  const removeTerminologyOverride = useCallback((key: string, targetLanguage: AppLanguage) => {
    setTerminologyOverrides((current) =>
      current.filter((item) => !(item.key === key && item.language === targetLanguage)),
    );
  }, []);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      language,
      direction,
      isRTL: direction === "rtl",
      locale,
      setLanguage,
      t,
      resolveLabel,
      terminologyOverrides,
      setTerminologyOverride,
      removeTerminologyOverride,
    }),
    [
      direction,
      language,
      locale,
      removeTerminologyOverride,
      resolveLabel,
      setLanguage,
      setTerminologyOverride,
      t,
      terminologyOverrides,
    ],
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLocalization(): LocalizationContextValue {
  return useContext(LocalizationContext);
}
