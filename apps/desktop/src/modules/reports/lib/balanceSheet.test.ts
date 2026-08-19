import { describe, it, expect } from "vitest";
import { computeBalanceSheet } from "./balanceSheet";
import type { AccountDto } from "@erp/shared-types";

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

describe("computeBalanceSheet", () => {
  it("handles empty accounts", () => {
    const result = computeBalanceSheet([], { netProfit: 0, totalDrawings: 0 });
    expect(result.totalAssets).toBe(0);
    expect(result.totalLiabilities).toBe(0);
    expect(result.totalEquity).toBe(0);
    expect(result.isBalanced).toBe(true);
    expect(result.sections).toHaveLength(5);
  });

  it("classifies fixed asset by code 11 prefix", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "111", name_ar: "أرض", account_type: "Assets", balance: "50000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalFixedAssets).toBe(50000);
    expect(result.totalCurrentAssets).toBe(0);
    expect(result.totalAssets).toBe(50000);
  });

  it("classifies fixed asset by Arabic name", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "999", name_ar: "أثاث مكتبي", account_type: "Assets", balance: "10000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalFixedAssets).toBe(10000);
  });

  it("classifies current asset by code 12 prefix", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "20000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentAssets).toBe(20000);
    expect(result.totalFixedAssets).toBe(0);
  });

  it("classifies current asset by name containing نقد", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "999", name_ar: "نقد في الصندوق", account_type: "Assets", balance: "15000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentAssets).toBe(15000);
  });

  it("classifies fixed liability by code 21 prefix", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "211", name_ar: "قرض طويل الأجل", account_type: "Liabilities", balance: "30000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalFixedLiabilities).toBe(30000);
  });

  it("classifies current liability by code 22 prefix", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "221", name_ar: "دائنون", account_type: "Liabilities", balance: "10000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentLiabilities).toBe(10000);
  });

  it("classifies current liability by name containing تكاليف", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "999", name_ar: "تكاليف إضافية على المشتريات", account_type: "Liabilities", balance: "5000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentLiabilities).toBe(5000);
  });

  it("classifies current liability by name مورد", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "999", name_ar: "موردون", account_type: "Liabilities", balance: "5000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentLiabilities).toBe(5000);
  });

  it("classifies equity accounts", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "100000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalEquity).toBe(100000);
  });

  it("creates full balance sheet that is balanced", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "111", name_ar: "أرض", account_type: "Assets", balance: "50000" }),
      acc({ id: "2", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "30000" }),
      acc({ id: "3", code: "211", name_ar: "قرض بنكي", account_type: "Liabilities", balance: "20000" }),
      acc({ id: "4", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "60000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalFixedAssets).toBe(50000);
    expect(result.totalCurrentAssets).toBe(30000);
    expect(result.totalAssets).toBe(80000);
    expect(result.totalFixedLiabilities).toBe(20000);
    expect(result.totalCurrentLiabilities).toBe(0);
    expect(result.totalLiabilities).toBe(20000);
    expect(result.totalEquity).toBe(60000);
    expect(result.totalLiabilitiesEquity).toBe(80000);
    expect(result.isBalanced).toBe(true);
  });

  it("includes net profit in equity", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "50000" }),
      acc({ id: "2", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "30000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 15000, totalDrawings: 0 });
    expect(result.totalEquity).toBe(45000);
    expect(result.netProfit).toBe(15000);
  });

  it("subtracts drawings from equity", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "55000" }),
      acc({ id: "2", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "40000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 20000, totalDrawings: 5000 });
    expect(result.totalEquity).toBe(55000);
    expect(result.totalDrawings).toBe(5000);
    expect(result.isBalanced).toBe(true);
  });

  it("isBalanced is false when accounts don't match", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "50000" }),
      acc({ id: "2", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "30000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalAssets).toBe(50000);
    expect(result.totalLiabilitiesEquity).toBe(30000);
    expect(result.isBalanced).toBe(false);
  });

  it("handles negative balances", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "-1000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentAssets).toBe(-1000);
  });

  it("builds correct section structure with all five sections", () => {
    const result = computeBalanceSheet([], { netProfit: 0, totalDrawings: 0 });
    expect(result.sections.map(s => s.id)).toEqual([
      "fixed-assets",
      "current-assets",
      "fixed-liabilities",
      "current-liabilities",
      "equity",
    ]);
  });

  it("equity section includes net profit and drawings rows", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "50000" }),
      acc({ id: "2", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "30000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 10000, totalDrawings: 2000 });
    const equitySection = result.sections.find(s => s.id === "equity")!;
    expect(equitySection.rows.some(r => r.label === "صافي الأرباح" && r.value === 10000)).toBe(true);
    expect(equitySection.rows.some(r => r.label === "إجمالي المسحوبات" && r.value === -2000)).toBe(true);
  });

  it("handles accounts with NaN/invalid balance gracefully", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "abc" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentAssets).toBe(0);
  });

  it("uses ledgerTotals instead of static balance when provided", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "99999" }),
    ];
    const ledgerTotals = new Map([["1", { debit: 30000, credit: 0 }]]);
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 }, ledgerTotals);
    expect(result.totalCurrentAssets).toBe(30000);
  });

  it("uses 0 for accounts not in ledgerTotals", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "50000" }),
      acc({ id: "2", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "60000" }),
    ];
    const ledgerTotals = new Map([["1", { debit: 20000, credit: 0 }]]);
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 }, ledgerTotals);
    expect(result.totalCurrentAssets).toBe(20000);
    expect(result.totalEquity).toBe(0);
    expect(result.isBalanced).toBe(false);
  });

  it("classifies تكاليف إضافية على المشتريات as current liability", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "50000" }),
      acc({ id: "2", code: "999", name_ar: "تكاليف إضافية على المشتريات", account_type: "Liabilities", balance: "5000" }),
      acc({ id: "3", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "45000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentLiabilities).toBe(5000);
    expect(result.totalLiabilities).toBe(5000);
    expect(result.totalEquity).toBe(45000);
    expect(result.totalAssets).toBe(50000);
    expect(result.totalLiabilitiesEquity).toBe(50000);
    expect(result.isBalanced).toBe(true);
  });

  it("does not double-count parent and child accounts", () => {
    const accounts: AccountDto[] = [
      acc({ id: "p1", code: "12", name_ar: "الأصول المتداولة", account_type: "Assets", parent_id: null, balance: "0" }),
      acc({ id: "c1", code: "121", name_ar: "صندوق", account_type: "Assets", parent_id: "p1", balance: "30000" }),
      acc({ id: "c2", code: "122", name_ar: "بنك", account_type: "Assets", parent_id: "p1", balance: "20000" }),
      acc({ id: "3", code: "311", name_ar: "رأس المال", account_type: "Equity", parent_id: null, balance: "50000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentAssets).toBe(50000);
    expect(result.totalEquity).toBe(50000);
    expect(result.isBalanced).toBe(true);
  });

  it("liabilities get positive values with ledgerTotals", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets" }),
      acc({ id: "2", code: "221", name_ar: "دائنون", account_type: "Liabilities" }),
      acc({ id: "3", code: "311", name_ar: "رأس المال", account_type: "Equity" }),
    ];
    const ledgerTotals = new Map([
      ["1", { debit: 80000, credit: 0 }],
      ["2", { debit: 0, credit: 30000 }],
      ["3", { debit: 0, credit: 50000 }],
    ]);
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 }, ledgerTotals);
    expect(result.totalCurrentAssets).toBe(80000);
    expect(result.totalCurrentLiabilities).toBe(30000);
    expect(result.totalEquity).toBe(50000);
    expect(result.totalLiabilitiesEquity).toBe(80000);
    expect(result.isBalanced).toBe(true);
  });

  it("ledgerTotals with mixed debit/credit for liability", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets" }),
      acc({ id: "2", code: "221", name_ar: "دائنون", account_type: "Liabilities" }),
    ];
    const ledgerTotals = new Map([
      ["1", { debit: 50000, credit: 0 }],
      ["2", { debit: 5000, credit: 25000 }],
    ]);
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 }, ledgerTotals);
    expect(result.totalCurrentLiabilities).toBe(20000);
    expect(result.totalLiabilities).toBe(20000);
    expect(result.totalEquity).toBe(0);
    expect(result.totalAssets).toBe(50000);
    expect(result.isBalanced).toBe(false);
  });

  it("excludes بضاعة أول المدة from current assets", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "30000" }),
      acc({ id: "2", code: "999", name_ar: "بضاعة أول المدة", account_type: "Assets", balance: "5000" }),
      acc({ id: "3", code: "998", name_ar: "بضاعة آخر المدة", account_type: "Assets", balance: "8000" }),
      acc({ id: "4", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "30000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentAssets).toBe(30000);
    const section = result.sections.find(s => s.id === "current-assets")!;
    expect(section.rows.some(r => r.label === "بضاعة أول المدة")).toBe(false);
    expect(section.rows.some(r => r.label === "بضاعة آخر المدة")).toBe(false);
    expect(section.rows.some(r => r.label === "صندوق")).toBe(true);
  });

  it("excludes any account containing بضاعة from current assets", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "10000" }),
      acc({ id: "2", code: "122", name_ar: "بضاعة", account_type: "Assets", balance: "5000" }),
      acc({ id: "3", code: "123", name_ar: "المخزون", account_type: "Assets", balance: "7000" }),
      acc({ id: "4", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "17000" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    expect(result.totalCurrentAssets).toBe(17000);
    const section = result.sections.find(s => s.id === "current-assets")!;
    expect(section.rows.some(r => r.label.includes("بضاعة"))).toBe(false);
    expect(section.rows.some(r => r.label === "المخزون")).toBe(true);
    expect(section.rows.some(r => r.label === "صندوق")).toBe(true);
  });

  it("uses closingInventory to override المخزون balance", () => {
    const accounts: AccountDto[] = [
      acc({ id: "1", code: "121", name_ar: "صندوق", account_type: "Assets", balance: "20000" }),
      acc({ id: "2", code: "999", name_ar: "المخزون", account_type: "Assets", balance: "99999" }),
      acc({ id: "3", code: "311", name_ar: "رأس المال", account_type: "Equity", balance: "20000" }),
      acc({ id: "4", code: "221", name_ar: "دائنون", account_type: "Liabilities", balance: "5000" }),
    ];
    const result = computeBalanceSheet(
      accounts,
      { netProfit: 10000, totalDrawings: 0 },
      undefined,
      { closingInventory: 15000 },
    );
    expect(result.totalCurrentAssets).toBe(35000);
    const section = result.sections.find(s => s.id === "current-assets")!;
    const invRow = section.rows.find(r => r.label === "المخزون");
    expect(invRow).toBeDefined();
    expect(invRow!.value).toBe(15000);
    expect(result.totalEquity).toBe(30000);
    expect(result.totalCurrentLiabilities).toBe(5000);
    expect(result.isBalanced).toBe(true);
  });

  it("shows the fixed-asset opening as 200 exactly once via ledgerTotals", () => {
    const accounts: AccountDto[] = [
      acc({ id: "fa1", code: "1115", name_ar: "أصول ثابتة", account_type: "Assets", balance: "99999" }),
      acc({ id: "eq1", code: "52", name_ar: "رأس المال", account_type: "Equity", balance: "99999" }),
    ];
    const ledgerTotals = new Map([
      ["fa1", { debit: 200, credit: 0 }],
      ["eq1", { debit: 0, credit: 200 }],
    ]);
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 }, ledgerTotals);
    expect(result.totalFixedAssets).toBe(200);
    expect(result.totalAssets).toBe(200);
    expect(result.totalEquity).toBe(200);
    expect(result.isBalanced).toBe(true);
  });

  it("exact opening scenario: FA once, residual once, A = L + E", () => {
    const accounts: AccountDto[] = [
      acc({ id: "fa1", code: "111", name_ar: "أصول ثابتة", account_type: "Assets" }),
      acc({ id: "cash1", code: "121", name_ar: "صندوق", account_type: "Assets" }),
      acc({ id: "loan1", code: "221", name_ar: "قرض بنكي", account_type: "Liabilities" }),
      acc({ id: "cap1", code: "311", name_ar: "رأس المال", account_type: "Equity" }),
      acc({ id: "obe1", code: "315", name_ar: "أرباح مرحلة", account_type: "Equity" }),
      acc({ id: "res1", code: "316", name_ar: "رصيد افتتاحي معاد تصنيفه", account_type: "Equity" }),
    ];

    // Posted opening journal (Dr: FA 200, Cash 150 / Cr: Loan 50, Capital 70,
    // OBE 230) followed by the residual reclassification journal (Dr OBE 30 /
    // Cr designated residual 30) — OBE nets to 200, the residual appears once.
    const ledgerTotals = new Map([
      ["fa1", { openingDebit: 200, openingCredit: 0, periodDebit: 0, periodCredit: 0, debit: 200, credit: 0, endingBalance: 200 }],
      ["cash1", { openingDebit: 150, openingCredit: 0, periodDebit: 0, periodCredit: 0, debit: 150, credit: 0, endingBalance: 150 }],
      ["loan1", { openingDebit: 0, openingCredit: 50, periodDebit: 0, periodCredit: 0, debit: 0, credit: 50, endingBalance: -50 }],
      ["cap1", { openingDebit: 0, openingCredit: 70, periodDebit: 0, periodCredit: 0, debit: 0, credit: 70, endingBalance: -70 }],
      ["obe1", { openingDebit: 0, openingCredit: 230, periodDebit: 30, periodCredit: 0, debit: 30, credit: 230, endingBalance: -200 }],
      ["res1", { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 30, debit: 0, credit: 30, endingBalance: -30 }],
    ]);

    const result = computeBalanceSheet(
      accounts,
      { netProfit: 0, totalDrawings: 0 },
      ledgerTotals as unknown as Map<string, { debit: number; credit: number }>,
    );

    expect(result.totalFixedAssets).toBe(200);
    expect(result.totalCurrentAssets).toBe(150);
    expect(result.totalAssets).toBe(350);

    expect(result.totalLiabilities).toBe(50);
    expect(result.totalEquity).toBe(300);
    expect(result.totalLiabilitiesEquity).toBe(350);
    expect(result.isBalanced).toBe(true);

    // Fixed asset contributes exactly its single GL amount.
    const faSection = result.sections.find(s => s.id === "fixed-assets")!;
    expect(faSection.rows).toHaveLength(1);
    expect(faSection.rows[0].value).toBe(200);

    // The residual appears exactly once in equity; OBE keeps the retained part.
    const eqSection = result.sections.find(s => s.id === "equity")!;
    const resRow = eqSection.rows.find(r => r.label === "رصيد افتتاحي معاد تصنيفه");
    expect(resRow?.value).toBe(30);
    const obeRow = eqSection.rows.find(r => r.label === "أرباح مرحلة");
    expect(obeRow?.value).toBe(200);
  });

  it("groups equity container children by purpose (retained earnings separated)", () => {
    // Real-chart shape: "حقوق الملكية" (5) is a tree container holding capital
    // (51 partner_capital), retained earnings (52 retained_earnings) and the
    // opening-clearing account (53).
    const accounts: AccountDto[] = [
      acc({ id: "e5", code: "5", name_ar: "حقوق الملكية", account_type: "Equity", parent_id: null, balance: "0" }),
      acc({ id: "e51", code: "51", name_ar: "رأس المال", account_type: "Equity", parent_id: "e5", balance: "300", purpose: "partner_capital" }),
      acc({ id: "e52", code: "52", name_ar: "الأرباح المبقاة", account_type: "Equity", parent_id: "e5", balance: "45", purpose: "retained_earnings" }),
      acc({ id: "e53", code: "53", name_ar: "رصيد افتتاحي", account_type: "Equity", parent_id: "e5", balance: "0", purpose: "opening_balance_equity" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    const eqSection = result.sections.find(s => s.id === "equity")!;

    // Container keeps its exact balance (the purpose buckets must sum to it).
    const container = eqSection.rows.find(r => r.label === "حقوق الملكية");
    expect(container?.value).toBe(345);
    expect(container?.children).toBeDefined();

    const partnerCapital = container!.children!.find(r => r.label === "رأس مال الشركاء");
    const retained = container!.children!.find(r => r.label === "الأرباح المبقاة");
    const other = container!.children!.find(r => r.label === "حقوق ملكية أخرى");

    expect(partnerCapital?.value).toBe(300);
    expect(partnerCapital?.children?.map(r => r.label)).toEqual(["رأس المال"]);
    expect(retained?.value).toBe(45);
    expect(retained?.children?.map(r => r.label)).toEqual(["الأرباح المبقاة"]);
    expect(other?.value).toBe(0);
    expect(other?.children?.map(r => r.label)).toEqual(["رصيد افتتاحي"]);

    expect(result.totalEquity).toBe(345);
  });

  it("keeps leaf-only equity charts flat (no container grouping)", () => {
    // A chart WITHOUT a tree-account container keeps the legacy flat rows —
    // retained earnings already shows on its own line.
    const accounts: AccountDto[] = [
      acc({ id: "51", code: "51", name_ar: "رأس المال", account_type: "Equity", balance: "300", purpose: "partner_capital" }),
      acc({ id: "52", code: "52", name_ar: "الأرباح المبقاة", account_type: "Equity", balance: "45", purpose: "retained_earnings" }),
    ];
    const result = computeBalanceSheet(accounts, { netProfit: 0, totalDrawings: 0 });
    const eqSection = result.sections.find(s => s.id === "equity")!;
    const labels = eqSection.rows.map(r => r.label);
    expect(labels).toContain("رأس المال");
    expect(labels).toContain("الأرباح المبقاة");
    expect(result.totalEquity).toBe(345);
  });
});
