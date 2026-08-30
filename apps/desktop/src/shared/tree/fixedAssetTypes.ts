import { SYSTEM_ACCOUNT_IDS } from "@erp/shared-types";

/**
 * Fixed-asset subtype (نوع الأصل). Single vocabulary shared by the
 * Chart-of-Accounts resolver/inference and the FixedAssetForm so the
 * "نوع الأصل" selection is derived from the selected asset account instead of
 * requiring the user to pick it again.
 */
export type FixedAssetType =
  | "buildings_land"
  | "automotive"
  | "equipment"
  | "furniture";

export const FIXED_ASSET_TYPE_LABELS: Record<FixedAssetType, string> = {
  buildings_land: "أبنية وأراضي",
  automotive: "آليات ومركبات",
  equipment: "معدات وتجهيزات",
  furniture: "أثاث ومفروشات",
};

/** Exact account ids that ARE the four asset-type accounts (1101/112/1102/1103). */
export const FIXED_ASSET_TYPE_BY_ACCOUNT_ID: Record<string, FixedAssetType> = {
  [SYSTEM_ACCOUNT_IDS.FIXED_ASSET_BUILDINGS]: "buildings_land",
  [SYSTEM_ACCOUNT_IDS.FIXED_ASSET_AUTOMOTIVE]: "automotive",
  [SYSTEM_ACCOUNT_IDS.FIXED_ASSET_EQUIPMENT]: "equipment",
  [SYSTEM_ACCOUNT_IDS.FIXED_ASSET_FURNITURE]: "furniture",
};

const TYPE_KEYWORDS: Record<FixedAssetType, string[]> = {
  buildings_land: ["أبنية", "أراضي", "أرض", "مبنى", "عقار", "land", "building"],
  automotive: ["آليات", "سيارات", "مركبات", "نقليات", "ثقيلة", "automotive", "machinery"],
  equipment: ["معدات", "تجهيزات", "جهاز", "equipment"],
  furniture: ["أثاث", "مفروشات", "كرسي", "طاولة", "furniture"],
};

export function detectFixedAssetTypeFromName(name: string): FixedAssetType | null {
  const lower = (name ?? "").toLowerCase();
  if (!lower) return null;
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS) as [FixedAssetType, string[]][]) {
    if (keywords.some((k) => lower.includes(k))) return type;
  }
  return null;
}