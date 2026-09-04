import type { AccountDto } from "@erp/shared-types";

/**
 * Auto-suggest the next available child code for a parent account.
 *
 * Algorithm:
 * 1. Find existing children at the target depth (parent.level + 1)
 * 2. If none exist, return parent code + "1" padded to target length
 * 3. If children exist, try incrementing the last digit if < 9
 * 4. Otherwise find first available digit 1-9
 * 5. If all digits used, wrap to "1"
 */
export function suggestChildCode(
  parent: AccountDto | null,
  allAccounts: AccountDto[],
): string {
  if (!parent) return "";
  const base = parent.code ?? "";
  const baseLen = (parent.level ?? 1) + 1;
  const children = allAccounts.filter((a) => a.parent_id === parent.id);
  const existingCodes = children.map((c) => c.code ?? "");
  const existingAtDepth = existingCodes.filter(
    (c) => c.length === baseLen,
  );

  if (existingAtDepth.length === 0) {
    const seed = base.length > 0 ? base + "1" : "1";
    const res = seed.length >= baseLen ? seed : seed.padEnd(baseLen, "0");
    return res.substring(0, baseLen);
  }

  const lastCode = existingAtDepth[existingAtDepth.length - 1];
  const lastDigit = parseInt(lastCode.charAt(base.length), 10);
  if (!isNaN(lastDigit) && lastDigit < 9) {
    return `${base}${lastDigit + 1}`;
  }

  for (let i = 1; i <= 9; i++) {
    const candidate = `${base}${i}`;
    if (!existingAtDepth.includes(candidate)) return candidate;
  }

  return (base + "1").substring(0, baseLen);
}

/**
 * Resolve the target level for a new account based on its parent.
 * Returns 1 for root-level accounts (parentId === "null").
 */
export function resolveLevel(
  parentId: string,
  allAccounts: AccountDto[],
): number {
  if (parentId === "null") return 1;
  const parentAccount = allAccounts.find((a) => a.id === parentId);
  return (parentAccount?.level ?? 1) + 1;
}
