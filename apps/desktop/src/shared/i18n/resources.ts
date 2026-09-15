import type { AppLanguage, I18nNamespace, TranslationTree } from "@shared/types/i18n";

import { common } from "./resources/common";
import { shell } from "./resources/shell";
import { search } from "./resources/search";
import { commands } from "./resources/commands";
import { voice } from "./resources/voice";
import { dashboard } from "./resources/dashboard";
import { accounting } from "./resources/accounting";
import { partners } from "./resources/partners";
import { invoicing } from "./resources/invoicing";
import { inventory } from "./resources/inventory";
import { fixedAssets } from "./resources/fixedAssets";
import { reports } from "./resources/reports";
import { settings } from "./resources/settings";
import { users } from "./resources/users";
import { auth } from "./resources/auth";
import { validation } from "./resources/validation";
import { errors } from "./resources/errors";
import { widgets } from "./resources/widgets";
import { openingBalance } from "./resources/openingBalance";
import { setup } from "./resources/setup";
import { audit } from "./resources/audit";

type NamespaceBundle = Record<I18nNamespace, TranslationTree>;

export const DEFAULT_LANGUAGE: AppLanguage = "ar";

export const LOCALE_BY_LANGUAGE: Record<AppLanguage, string> = {
  ar: "ar-SY",
  en: "en-US",
};

export const DIRECTION_BY_LANGUAGE: Record<AppLanguage, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export const NAMESPACE_BUNDLES: Record<I18nNamespace, Record<AppLanguage, TranslationTree>> = {
  common,
  shell,
  search,
  commands,
  voice,
  dashboard,
  accounting,
  partners,
  invoicing,
  inventory,
  fixedAssets,
  reports,
  settings,
  users,
  auth,
  validation,
  errors,
  widgets,
  openingBalance,
  setup,
  audit,
};

export const I18N_RESOURCES: Record<AppLanguage, NamespaceBundle> = {
  ar: Object.fromEntries(
    Object.entries(NAMESPACE_BUNDLES).map(([namespace, bundle]) => [namespace, bundle.ar]),
  ) as Record<I18nNamespace, TranslationTree>,
  en: Object.fromEntries(
    Object.entries(NAMESPACE_BUNDLES).map(([namespace, bundle]) => [namespace, bundle.en]),
  ) as Record<I18nNamespace, TranslationTree>,
};

export function getNestedTranslation(tree: TranslationTree, key: string): string | undefined {
  const parts = key.split(".");
  let current: string | TranslationTree | undefined = tree;
  for (const part of parts) {
    if (!current || typeof current === "string") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

const ARABIC_PLURAL_CATEGORY = (count: number): string => {
  if (count === 0) return "zero";
  if (count === 1) return "one";
  if (count === 2) return "two";
  if (count >= 3 && count <= 10) return "few";
  if (count >= 11 && count <= 99) return "many";
  return "many";
};

const ENGLISH_PLURAL_CATEGORY = (count: number): string => (count === 1 ? "one" : "other");

export function pluralCategory(language: AppLanguage, count: number): string {
  return language === "ar" ? ARABIC_PLURAL_CATEGORY(count) : ENGLISH_PLURAL_CATEGORY(count);
}

export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}