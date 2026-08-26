import type { AccountDto } from "@erp/shared-types";

/**
 * Shared account-tree builder consumed by balanceSheet.ts and trialBalance.ts.
 *
 * Constructs a parent→child tree from a flat `AccountDto[]`, sorted by code,
 * with recursive depth tracking.  Each node is produced by a caller-supplied
 * `computeNode` callback so the two consumers can attach their own per-node
 * fields (single balance vs. opening/period/tot debit/credit splits).
 *
 * The caller also provides `shouldKeepOwn` to decide whether an inventory
 * account should retain its own ledger data rather than being overwritten by
 * the children sum.
 */

export interface TreeNode<T> {
  id: string;
  code: string;
  name: string;
  depth: number;
  keepOwn: boolean;
  hasChildren: boolean;
  account: AccountDto;
  children: TreeNode<T>[];
  data: T;
}

export type ComputeNodeFn<T> = (
  account: AccountDto,
  ctx: {
    depth: number;
    hasChildren: boolean;
    keepOwn: boolean;
    childrenData: T[];
  },
) => T;

export type ShouldKeepOwnFn = (
  account: AccountDto,
  ctx: { hasChildren: boolean },
) => boolean;

/**
 * Build a parent→child tree from a flat account list.
 *
 * @param accounts  Flat list of all accounts.
 * @param computeNode  Callback that computes per-node data for each account.
 * @param shouldKeepOwn  Callback that decides whether an account keeps its own data
 *                        (used for inventory accounts that have their own balance).
 * @param parentId  Parent to filter by (null = roots).
 * @param depth  Current recursion depth.
 */
export function buildAccountTree<T>(
  accounts: AccountDto[],
  computeNode: ComputeNodeFn<T>,
  shouldKeepOwn: ShouldKeepOwnFn,
  parentId: string | null = null,
  depth = 0,
): TreeNode<T>[] {
  const children = accounts
    .filter((a) =>
      parentId === null
        ? !a.parent_id || a.parent_id === a.id || !accounts.find((p) => p.id === a.parent_id)
        : a.parent_id === parentId,
    )
    .sort((a, b) => a.code.localeCompare(b.code));

  return children.map((acc) => {
    const subTree = buildAccountTree(accounts, computeNode, shouldKeepOwn, acc.id, depth + 1);
    const hasChildren = subTree.length > 0;
    const keepOwn = shouldKeepOwn(acc, { hasChildren });

    const data = computeNode(acc, {
      depth,
      hasChildren,
      keepOwn,
      childrenData: subTree.map((c) => c.data),
    });

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name_ar,
      depth,
      keepOwn,
      hasChildren,
      account: acc,
      children: subTree,
      data,
    };
  });
}
