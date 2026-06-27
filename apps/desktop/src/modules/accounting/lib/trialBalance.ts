import type { AccountDto } from "@erp/shared-types";

export interface TrialBalanceRow {
  account: AccountDto;
  depth: number;
}

export interface TrialBalanceTreeRow {
  id: string;
  name: string;
  depth: number;
  balance: number;
  debit: number;
  credit: number;
  balanceSec: number;
  debitSec: number;
  creditSec: number;
}

export interface AccountTreeTotals {
  id: string;
  name: string;
  depth: number;
  totDebit: number;
  totCredit: number;
  children: AccountTreeTotals[];
}

export function flattenTree(accounts: AccountDto[]): TrialBalanceRow[] {
  const map = new Map<string, AccountDto[]>();
  const roots: AccountDto[] = [];
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));

  for (const acc of sorted) {
    if (acc.parent_id && acc.parent_id !== acc.id && accounts.find(a => a.id === acc.parent_id)) {
      const children = map.get(acc.parent_id) || [];
      children.push(acc);
      map.set(acc.parent_id, children);
    } else {
      roots.push(acc);
    }
  }

  const result: TrialBalanceRow[] = [];

  function traverse(ids: AccountDto[], depth: number) {
    for (const acc of ids) {
      result.push({ account: acc, depth });
      const children = map.get(acc.id);
      if (children) {
        traverse(children, depth + 1);
      }
    }
  }

  traverse(roots, 0);
  return result;
}

export function isBalanceDebit(balance: number): "مدين" | "دائن" | null {
  if (balance > 0) return "مدين";
  if (balance < 0) return "دائن";
  return null;
}

export function computeTreeTotals(
  accounts: AccountDto[],
  ltMap: Map<string, { debit: number; credit: number }>,
  parentId: string | null = null,
  depth = 0,
): AccountTreeTotals[] {
  const children = accounts
    .filter((a) =>
      parentId === null
        ? !a.parent_id || a.parent_id === a.id || !accounts.find((p) => p.id === a.parent_id)
        : a.parent_id === parentId,
    )
    .sort((a, b) => a.code.localeCompare(b.code));

  return children.map((acc) => {
    const subTree = computeTreeTotals(accounts, ltMap, acc.id, depth + 1);
    const lt = ltMap.get(acc.id);
    const ownDebit = lt?.debit ?? 0;
    const ownCredit = lt?.credit ?? 0;

    let totDebit = ownDebit;
    let totCredit = ownCredit;

    if (subTree.length > 0) {
      const sumDebit = subTree.reduce((s, c) => s + c.totDebit, 0);
      const sumCredit = subTree.reduce((s, c) => s + c.totCredit, 0);
      totDebit = ownDebit + sumDebit;
      totCredit = ownCredit + sumCredit;
    }

    return { id: acc.id, name: acc.name_ar, depth, totDebit, totCredit, children: subTree };
  });
}

export function flattenTreeRows(nodes: AccountTreeTotals[], maxDepth: number): TrialBalanceTreeRow[] {
  const result: TrialBalanceTreeRow[] = [];

  function traverse(list: AccountTreeTotals[]) {
    for (const node of list) {
      if (node.depth > maxDepth) continue;

      // Hide parent if its direct children are also visible at this depth
      // (prevents duplication — e.g. hide "الأصول" when "الأصول الثابتة" replaces it)
      const childrenVisible = node.children.length > 0 && (node.children[0]?.depth ?? Infinity) <= maxDepth;

      if (!childrenVisible) {
        const balance = node.totDebit - node.totCredit;
        result.push({
          id: node.id,
          name: node.name,
          depth: node.depth,
          balance,
          debit: node.totDebit,
          credit: node.totCredit,
          balanceSec: 0,
          debitSec: 0,
          creditSec: 0,
        });
      }

      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return result;
}
