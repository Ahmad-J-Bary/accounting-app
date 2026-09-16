import type { AppLanguage } from "@shared/types/i18n";
import type { AccountDto } from "@erp/shared-types";
import type { CategoryDto } from "@erp/shared-types";

const CASH_PARTNER_CODE = "0";

const DEFAULT_CATEGORY_ID = "00000000-0000-0000-0000-000000000001";

export function isCashPartner(code: string): boolean {
  return code === CASH_PARTNER_CODE;
}

export function resolveAccountName(account: AccountDto, language: AppLanguage): string {
  return language === "ar" ? account.name_ar : account.name_en;
}

export function resolveCashPartnerName(
  type: "customer" | "supplier",
  language: AppLanguage,
  t: (key: string, options?: { namespace?: string }) => string,
): string {
  const key = type === "customer" ? "system.cashCustomer" : "system.cashSupplier";
  return t(key, { namespace: "common" });
}

export function resolveCategoryName(
  category: CategoryDto,
  language: AppLanguage,
  t: (key: string, options?: { namespace?: string }) => string,
): string {
  if (category.id === DEFAULT_CATEGORY_ID) {
    return t("system.uncategorized", { namespace: "common" });
  }
  return category.name;
}

export function resolvePartnerDisplayName(
  name: string,
  code: string,
  type: "customer" | "supplier",
  language: AppLanguage,
  t: (key: string, options?: { namespace?: string }) => string,
): string {
  if (isCashPartner(code)) {
    return resolveCashPartnerName(type, language, t);
  }
  return name;
}
