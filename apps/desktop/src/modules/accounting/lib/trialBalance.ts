import type { AccountDto } from "@erp/shared-types";

export interface TrialBalanceRow {
  account: AccountDto;
  depth: number;
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
