import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import type { AccountTreeNode } from "./types";
import { isOpeningStockAccount } from "./tree-utils";

/**
 * Compute balances from actual general ledger totals, then propagate up the
 * tree so every parent's balance = sum of its direct children's balances.
 *
 * بضاعة أول المدة (opening stock) is excluded from the parent sums: it is a
 * display-only figure inside the Chart of Accounts — its own row still carries
 * its ledger balance (rendered in parentheses) but it never feeds the assets
 * totals. بضاعة آخر المدة / any other account is counted normally.
 */
export function computeTreeBalances(
  nodes: AccountTreeNode[],
  ltMap: Map<string, { debit: number; credit: number }>,
): AccountTreeNode[] {
  return nodes.map((node) => {
    const lt = ltMap.get(node.id);
    const ownBalance = lt ? lt.debit - lt.credit : 0;
    if (!node.children?.length) {
      return { ...node, balance: String(ownBalance) };
    }
    const computedChildren = computeTreeBalances(node.children, ltMap);
    const childrenSum = computedChildren.reduce((sum, child) => {
      if (isOpeningStockAccount(child.name_ar)) return sum;
      return sum + parseSafeNumber(child.balance);
    }, 0);
    return { ...node, balance: String(childrenSum), children: computedChildren };
  });
}