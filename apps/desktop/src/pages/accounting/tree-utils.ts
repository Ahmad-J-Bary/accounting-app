import type { AccountDto } from "@erp/shared-types";
import type { AccountTreeNode } from "./types";

export const isSummaryAccount = (
  account: Pick<AccountDto, "category" | "level">,
): boolean => account.category === "Summary" || (account.level ?? 1) <= 2;

export const parseAmount = (
  value: string | number | null | undefined,
): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export function buildTree(accounts: AccountDto[]): AccountTreeNode[] {
  const map = new Map<string, AccountTreeNode>();
  const roots: AccountTreeNode[] = [];

  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));

  for (const account of sorted) {
    map.set(account.id, { ...account, children: [] });
  }

  for (const account of sorted) {
    const node = map.get(account.id);
    if (!node) continue;

    if (account.parent_id && map.has(account.parent_id)) {
      map.get(account.parent_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function getVisibleRootTree(
  roots: AccountTreeNode[],
  query: string,
): AccountTreeNode[] {
  const q = query.trim();
  if (!q) return roots;

  const includesQuery = (a: Pick<AccountDto, "name_ar" | "code">): boolean =>
    a.name_ar.includes(q) || a.code.includes(q);

  const hasMatchingDescendant = (node: AccountTreeNode): boolean =>
    node.children.some(
      (child) => includesQuery(child) || hasMatchingDescendant(child),
    );

  return roots.filter(
    (node) => includesQuery(node) || hasMatchingDescendant(node),
  );
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return "حدث خطأ غير متوقع";
};
