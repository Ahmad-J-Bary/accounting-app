import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DIRECTION_BY_LANGUAGE,
  DEFAULT_LANGUAGE,
  I18N_RESOURCES,
  LOCALE_BY_LANGUAGE,
  getNestedTranslation,
} from "@shared/i18n/resources";
import type {
  AppLanguage,
  LocalizationContextValue,
  TerminologyOverride,
} from "@shared/types/i18n";
import { setDirection, setLocale } from "@shared/lib/format";

const LANGUAGE_STORAGE_KEY = "erp_language";
const TERMINOLOGY_STORAGE_KEY = "erp_terminology_overrides";

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

function loadLanguage(): AppLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "en" ? "en" : DEFAULT_LANGUAGE;
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

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    setLocale(locale);
    setDirection(direction);
  }, [direction, language, locale]);

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
      const translated = getNestedTranslation(bundle, key);
      return resolveLabel(`${namespace}.${key}`, translated || options?.fallback || key);
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

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error("useLocalization must be used within LocalizationProvider");
  }
  return context;
}
