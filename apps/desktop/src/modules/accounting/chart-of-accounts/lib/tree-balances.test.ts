import { describe, it, expect } from "vitest";
import { computeTreeBalances } from "./tree-balances";
import { buildTree } from "./tree-utils";
import type { AccountDto } from "@erp/shared-types";
import type { AccountTreeNode } from "./types";

function account(
  code: string,
  name: string,
  type: string,
  parentId: string | null,
  balance: string,
): AccountDto {
  return {
    id: `id-${code}`,
    code,
    name_ar: name,
    name_en: name,
    account_type: type,
    parent_id: parentId ? `id-${parentId}` : null,
    category: parentId ? "Detail" : "Summary",
    level: code.length,
    opening_balance: "0",
    balance,
    notes: null,
    is_active: true,
    is_default: false,
    is_final: true,
    linked_customer_id: null,
    linked_supplier_id: null,
    debit: "0",
    credit: "0",
    purpose: undefined,
  };
}

function ledger(code: string, debit: number, credit = 0): [string, { debit: number; credit: number }] {
  return [`id-${code}`, { debit, credit }];
}

const tree = (accounts: AccountDto[]): AccountTreeNode[] => buildTree(accounts);

describe("computeTreeBalances — opening-stock exclusion", () => {
  it("excludes بضاعة أول المدة from the parent sum but keeps its own ledger balance", () => {
    const accounts: AccountDto[] = [
      account("1", "الأصول", "Assets", null, "0"),
      account("12", "الأصول المتداولة", "Assets", "1", "0"),
      account("121", "بضاعة أول المدة", "Assets", "12", "0"),
      account("122", "الصندوق", "Assets", "12", "0"),
    ];
    const ltMap = new Map([
      ledger("121", 5000),
      ledger("122", 30000),
    ]);
    const [assets] = computeTreeBalances(tree(accounts), ltMap);
    const [current] = assets.children;
    expect(current.balance).toBe("30000");
    const [openingStock, cash] = current.children;
    expect(openingStock.name_ar).toBe("بضاعة أول المدة");
    expect(openingStock.balance).toBe("5000");
    expect(cash.balance).toBe("30000");
  });

  it("counts بضاعة آخر المدة into the assets total", () => {
    const accounts: AccountDto[] = [
      account("1", "الأصول", "Assets", null, "0"),
      account("12", "الأصول المتداولة", "Assets", "1", "0"),
      account("121", "بضاعة أول المدة", "Assets", "12", "0"),
      account("124", "المخزون", "Assets", "12", "0"),
      account("1241", "بضاعة آخر المدة", "Assets", "124", "0"),
    ];
    const ltMap = new Map([
      ledger("121", 5000),
      ledger("1241", 8000),
    ]);
    const [assets] = computeTreeBalances(tree(accounts), ltMap);
    const [current] = assets.children;
    expect(current.balance).toBe("8000");
    const inventory = current.children.find((c) => c.code === "124")!;
    expect(inventory.balance).toBe("8000");
  });

  it("root balance reflects the exclusion (totalAssets excludes opening stock)", () => {
    const accounts: AccountDto[] = [
      account("1", "الأصول", "Assets", null, "0"),
      account("12", "الأصول المتداولة", "Assets", "1", "0"),
      account("121", "بضاعة أول المدة", "Assets", "12", "0"),
      account("122", "الصندوق", "Assets", "12", "0"),
    ];
    const ltMap = new Map([
      ledger("121", 5000),
      ledger("122", 30000),
    ]);
    const [assets] = computeTreeBalances(tree(accounts), ltMap);
    expect(assets.balance).toBe("30000");
  });

  it("computes natural positive credit balances for Liabilities, Equity, and Revenue", () => {
    const accounts: AccountDto[] = [
      account("2", "الخصوم", "Liabilities", null, "0"),
      account("21", "الموردون", "Liabilities", "2", "0"),
      account("3", "حقوق الملكية", "Equity", null, "0"),
      account("31", "رأس المال", "Equity", "3", "0"),
    ];
    const ltMap = new Map([
      ledger("21", 0, 15000), // 15000 Credit
      ledger("31", 0, 50000), // 50000 Credit
    ]);
    const [liabilities, equity] = computeTreeBalances(tree(accounts), ltMap);
    expect(liabilities.balance).toBe("15000");
    expect(equity.balance).toBe("50000");
  });
});