import type { AccountDto } from "@erp/shared-types";
import type { AccountTreeNode } from "./types";
import { isInventoryAccount } from "@modules/reports/lib/accountingEntryClassifier";

export const isSummaryAccount = (
  _account: Pick<AccountDto, "category" | "level">,
): boolean => true; // All accounts are Summary (can have children)

/**
 * Opening-stock account (بضاعة أول المدة): within the Chart of Accounts its
 * balance is NOT counted into the parent / assets totals — it is only a
 * display-only figure shown in parentheses next to the account name.
 */
export const isOpeningStockAccount = (name: string): boolean =>
  name.includes("بضاعة أول المدة");

export function buildTree(accounts: AccountDto[]): AccountTreeNode[] {
  const map = new Map<string, AccountTreeNode>();
  const roots: AccountTreeNode[] = [];

  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));

  for (const account of sorted) {
    map.set(account.id, { ...account, children: [] });
  }

  const attachedIds = new Set<string>();

  // Helper to check for cycles
  const isAncestor = (parentId: string, nodeId: string): boolean => {
    let current = map.get(parentId);
    while (current) {
      if (current.id === nodeId) return true;
      if (!current.parent_id) break;
      current = map.get(current.parent_id);
    }
    return false;
  };

  for (const account of sorted) {
    const node = map.get(account.id);
    if (!node) continue;

    if (account.parent_id && account.parent_id !== account.id && map.has(account.parent_id)) {
      if (!attachedIds.has(account.id) && !isAncestor(account.parent_id, account.id)) {
        map.get(account.parent_id)?.children.push(node);
        attachedIds.add(account.id);
      } else if (!attachedIds.has(account.id)) {
        roots.push(node);
        attachedIds.add(account.id);
      }
    } else if (!attachedIds.has(account.id)) {
      roots.push(node);
      attachedIds.add(account.id);
    }
  }

  return roots;
}

export function getVisibleRootTree(
  roots: AccountTreeNode[],
  query: string,
): AccountTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return roots;

  const includesQuery = (a: Pick<AccountDto, "name_ar" | "code">): boolean =>
    a.name_ar.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);

  // Helper with depth limit to prevent infinite recursion on circular data
  const hasMatchingDescendant = (node: AccountTreeNode, depth = 0): boolean => {
    if (depth > 20) return false; // Sanity check for deep trees
    return node.children.some(
      (child) => includesQuery(child) || hasMatchingDescendant(child, depth + 1),
    );
  };

  return roots.filter(
    (node) => includesQuery(node) || hasMatchingDescendant(node),
  );
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return "حدث خطأ غير متوقع";
};
