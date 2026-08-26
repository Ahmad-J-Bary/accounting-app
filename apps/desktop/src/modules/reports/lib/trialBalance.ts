import type { AccountDto } from "@erp/shared-types";
import type { AccountLedgerTotal } from "./ledgerTotals";
import { isInventoryAccount } from "@modules/reports/lib/accountingEntryClassifier";
import { buildAccountTree, type TreeNode } from "./accountTree";

export interface TrialBalanceRow {
  account: AccountDto;
  depth: number;
}

export interface TrialBalanceTreeRow {
  id: string;
  name: string;
  depth: number;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  balance: number;
  debit: number;
  credit: number;
  balanceSec: number;
  debitSec: number;
  creditSec: number;
  openingDebitSec: number;
  openingCreditSec: number;
  periodDebitSec: number;
  periodCreditSec: number;
}

export interface AccountTreeTotals {
  id: string;
  name: string;
  depth: number;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  totDebit: number;
  totCredit: number;
  endingBalance: number;
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
  ltMap: Map<string, AccountLedgerTotal>,
): AccountTreeTotals[] {
  function extractData(nodes: ReturnType<typeof buildAccountTree<AccountTreeTotals>>): AccountTreeTotals[] {
    return nodes.map((n) => ({
      ...n.data,
      children: extractData(n.children),
    }));
  }

  return extractData(
    buildAccountTree<AccountTreeTotals>(
      accounts,
      (acc, { depth, hasChildren, keepOwn, childrenData }) => {
        const lt = ltMap.get(acc.id);

        let openingDebit = hasChildren && !keepOwn ? 0 : (lt?.openingDebit ?? 0);
        let openingCredit = hasChildren && !keepOwn ? 0 : (lt?.openingCredit ?? 0);
        let periodDebit = hasChildren && !keepOwn ? 0 : (lt?.periodDebit ?? 0);
        let periodCredit = hasChildren && !keepOwn ? 0 : (lt?.periodCredit ?? 0);
        let totDebit = hasChildren && !keepOwn ? 0 : (lt?.debit ?? 0);
        let totCredit = hasChildren && !keepOwn ? 0 : (lt?.credit ?? 0);

        if (hasChildren && !keepOwn) {
          openingDebit += childrenData.reduce((s, c) => s + c.openingDebit, 0);
          openingCredit += childrenData.reduce((s, c) => s + c.openingCredit, 0);
          periodDebit += childrenData.reduce((s, c) => s + c.periodDebit, 0);
          periodCredit += childrenData.reduce((s, c) => s + c.periodCredit, 0);
          totDebit += childrenData.reduce((s, c) => s + c.totDebit, 0);
          totCredit += childrenData.reduce((s, c) => s + c.totCredit, 0);
        }

        const endingBalance = (openingDebit - openingCredit) + periodDebit - periodCredit;

        return {
          id: acc.id,
          name: acc.name_ar,
          depth,
          openingDebit,
          openingCredit,
          periodDebit,
          periodCredit,
          totDebit,
          totCredit,
          endingBalance,
          children: [],
        };
      },
      (acc, { hasChildren }) => {
        const lt = ltMap.get(acc.id);
        const hasOwnPostings =
          !!lt &&
          (lt.openingDebit !== 0 ||
            lt.openingCredit !== 0 ||
            lt.periodDebit !== 0 ||
            lt.periodCredit !== 0);
        return isInventoryAccount({ purpose: acc.purpose, name_ar: acc.name_ar }) && hasOwnPostings && hasChildren;
      },
    ),
  );
}

export function flattenTreeRows(nodes: AccountTreeTotals[], maxDepth: number): TrialBalanceTreeRow[] {
  const result: TrialBalanceTreeRow[] = [];

  function traverse(list: AccountTreeTotals[]) {
    for (const node of list) {
      if (node.depth > maxDepth) continue;

      const childrenVisible = node.children.length > 0 && (node.children[0]?.depth ?? Infinity) <= maxDepth;

      if (!childrenVisible) {
        result.push({
          id: node.id,
          name: node.name,
          depth: node.depth,
          openingDebit: node.openingDebit,
          openingCredit: node.openingCredit,
          periodDebit: node.periodDebit,
          periodCredit: node.periodCredit,
          balance: node.endingBalance,
          debit: node.totDebit,
          credit: node.totCredit,
          balanceSec: 0,
          debitSec: 0,
          creditSec: 0,
          openingDebitSec: 0,
          openingCreditSec: 0,
          periodDebitSec: 0,
          periodCreditSec: 0,
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

