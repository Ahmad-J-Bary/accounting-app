import { describe, it, expect } from "vitest";
import { computeTreeTotals, flattenTreeRows, flattenTree, isBalanceDebit } from "./trialBalance";
import type { AccountDto } from "@erp/shared-types";
import type { AccountLedgerTotal } from "./ledgerTotals";

function acc(overrides: Partial<AccountDto> & { id: string; code: string; name_ar: string }): AccountDto {
  return {
    name_en: "",
    account_type: "Assets",
    parent_id: null,
    category: "Detail",
    level: 0,
    opening_balance: "0",
    balance: "0",
    notes: null,
    is_active: true,
    is_default: false,
    is_final: false,
    linked_customer_id: null,
    linked_supplier_id: null,
    debit: "0",
    credit: "0",
    ...overrides,
  };
}

function lt(overrides: Partial<AccountLedgerTotal>): AccountLedgerTotal {
  return {
    openingDebit: 0,
    openingCredit: 0,
    periodDebit: 0,
    periodCredit: 0,
    debit: 0,
    credit: 0,
    endingBalance: 0,
    ...overrides,
  };
}

describe("computeTreeTotals — parent derives from descendants only", () => {
  const parent = acc({ id: "p1", code: "12", name_ar: "الأصول المتداولة" });
  const child1 = acc({ id: "c1", code: "121", name_ar: "صندوق", parent_id: "p1" });
  const child2 = acc({ id: "c2", code: "122", name_ar: "بنك", parent_id: "p1" });
  const equity = acc({ id: "e1", code: "311", name_ar: "رأس المال", account_type: "Equity" });

  const ledgerTotals = new Map<string, AccountLedgerTotal>([
    // A stray posting/static opening on the parent itself: must be ignored when
    // the parent rolls up its descendants (rule 5 — no parent+child double count).
    ["p1", lt({ openingDebit: 50, debit: 50, endingBalance: 50 })],
    ["c1", lt({ periodDebit: 300, debit: 300, endingBalance: 300 })],
    ["c2", lt({ periodDebit: 200, debit: 200, endingBalance: 200 })],
    ["e1", lt({ periodCredit: 500, credit: 500, endingBalance: -500 })],
  ]);

  it("parent total equals the children sum, never parent + children", () => {
    const nodes = computeTreeTotals([parent, child1, child2, equity], ledgerTotals);
    const parentNode = nodes.find((n) => n.id === "p1")!;
    const own = ledgerTotals.get("p1")!;

    expect(parentNode.periodDebit).toBe(500);
    expect(parentNode.totDebit).toBe(500);
    expect(parentNode.endingBalance).toBe(500);
    expect(parentNode.totDebit).not.toBe(own.debit + 500);
    expect(parentNode.children).toHaveLength(2);
  });

  it("leaf accounts keep their own ledger totals", () => {
    const nodes = computeTreeTotals([parent, child1, child2, equity], ledgerTotals);
    const parentNode = nodes.find((n) => n.id === "p1")!;
    const child1Node = parentNode.children.find((n) => n.id === "c1")!;
    expect(child1Node.periodDebit).toBe(300);
    expect(child1Node.endingBalance).toBe(300);
  });
});

describe("computeTreeTotals — trial balance stays balanced (Dr = Cr)", () => {
  it("sums of debit and credit totals across the tree are equal", () => {
    const cash = acc({ id: "cash1", code: "1910", name_ar: "صندوق" });
    const capital = acc({ id: "eq1", code: "3910", name_ar: "رأس المال", account_type: "Equity" });
    const sales = acc({
      id: "rev1",
      code: "511",
      name_ar: "المبيعات",
    });

    // Cash 1000 Dr vs Capital 400 + Sales 600 Cr (Sales is a credit-nature account).
    const ledgerTotals = new Map<string, AccountLedgerTotal>([
      ["cash1", lt({ periodDebit: 1000, debit: 1000, endingBalance: 1000 })],
      ["eq1", lt({ periodCredit: 400, credit: 400, endingBalance: -400 })],
      ["rev1", lt({ periodCredit: 600, credit: 600, endingBalance: -600 })],
    ]);

    const nodes = computeTreeTotals([cash, capital, sales], ledgerTotals);
    const totalDr = nodes.reduce((s, n) => s + n.totDebit, 0);
    const totalCr = nodes.reduce((s, n) => s + n.totCredit, 0);
    expect(totalDr).toBe(1000);
    expect(totalCr).toBe(1000);
    expect(totalDr).toBe(totalCr);
  });
});

describe("flattenTree / flattenTreeRows", () => {
  it("renders only leaf rows when the parent has visible children", () => {
    const parent = acc({ id: "p1", code: "12", name_ar: "الأصول المتداولة" });
    const child1 = acc({ id: "c1", code: "121", name_ar: "صندوق", parent_id: "p1" });
    const child2 = acc({ id: "c2", code: "122", name_ar: "بنك", parent_id: "p1" });
    const equity = acc({ id: "e1", code: "311", name_ar: "رأس المال", account_type: "Equity" });

    const ledgerTotals = new Map<string, AccountLedgerTotal>([
      ["c1", lt({ periodDebit: 300, debit: 300, endingBalance: 300 })],
      ["c2", lt({ periodDebit: 200, debit: 200, endingBalance: 200 })],
      ["e1", lt({ periodCredit: 500, credit: 500, endingBalance: -500 })],
    ]);

    const rows = flattenTreeRows(computeTreeTotals([parent, child1, child2, equity], ledgerTotals), 3);
    expect(rows.map((r) => r.id)).toEqual(["c1", "c2", "e1"]);
    expect(rows.find((r) => r.id === "c1")!.periodDebit).toBe(300);
  });

  it("flattenTree orders sibling accounts by code", () => {
    const b = acc({ id: "b1", code: "122", name_ar: "بنك" });
    const a = acc({ id: "a1", code: "121", name_ar: "صندوق" });
    const rows = flattenTree([a, b]);
    expect(rows.map((r) => r.account.id)).toEqual(["a1", "b1"]);
  });
});

describe("isBalanceDebit", () => {
  it("labels positive debit, negative credit, zero balanced", () => {
    expect(isBalanceDebit(10)).toBe("مدين");
    expect(isBalanceDebit(-10)).toBe("دائن");
    expect(isBalanceDebit(0)).toBeNull();
  });
});