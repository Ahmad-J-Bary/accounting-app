import type { AppLanguage } from "@shared/types/i18n";
import type { AccountDto } from "@erp/shared-types";
import type { CategoryDto } from "@erp/shared-types";
import type { WarehouseDto } from "@erp/shared-types";

const CASH_PARTNER_CODE = "0";

const DEFAULT_CATEGORY_ID = "00000000-0000-0000-0000-000000000001";
const UNCATEGORIZED_CATEGORY_SYSTEM_KEY = "inventory.category.uncategorized";
const GENERAL_SUBCATEGORY_SYSTEM_KEY = "inventory.category.general-sub";

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
  t: (key: string, options?: { namespace?: string }) => string,
): string {
  if (isUncategorizedCategory(category)) {
    return t("materials.uncategorized", { namespace: "inventory" });
  }

  if (isGeneralSubcategory(category)) {
    return t("categories.generalSubName", { namespace: "inventory" });
  }

  return category.name;
}

export function isUncategorizedCategory(category: Pick<CategoryDto, "id" | "system_key">): boolean {
  return category.id === DEFAULT_CATEGORY_ID || category.system_key === UNCATEGORIZED_CATEGORY_SYSTEM_KEY;
}

export function isGeneralSubcategory(
  category: Pick<CategoryDto, "system_key"> | null | undefined,
): boolean {
  return category?.system_key === GENERAL_SUBCATEGORY_SYSTEM_KEY;
}

export function findGeneralSubcategory(
  categories: CategoryDto[],
  parentId: string,
): CategoryDto | undefined {
  return categories.find(
    (category) => category.parent_id === parentId && isGeneralSubcategory(category),
  );
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

export function resolveWarehouseDisplayName(
  warehouse: Pick<WarehouseDto, "name" | "is_default">,
  t: (key: string, options?: { namespace?: string }) => string,
): string {
  const trimmed = warehouse.name.trim();
  const looksLikeLegacyGeneratedDefault =
    warehouse.is_default &&
    (trimmed.startsWith("مستودع ") ||
      trimmed.startsWith("Warehouse ") ||
      trimmed === "مستودع الشركة" ||
      trimmed === "Company Warehouse");

  if (looksLikeLegacyGeneratedDefault) {
    return t("warehouses.companyDefault", { namespace: "inventory" });
  }

  return warehouse.name;
}

export function resolveUncategorizedPrefix(language: AppLanguage): string {
  return language === "ar" ? "غ" : "U";
}

