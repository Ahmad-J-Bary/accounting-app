import { describe, it, expect } from "vitest";
import { computeLedgerTotals } from "./ledgerTotals";
import { computeTreeTotals } from "./trialBalance";
import { computeBalanceSheet } from "./balanceSheet";
import type { AccountDto, JournalEntryDto } from "@erp/shared-types";
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

function line(account_id: string, debit: string, credit: string): JournalEntryDto["lines"][number] {
  return {
    account_id,
    currency: "S",
    fx_rate: "1",
    debit,
    credit,
    debit_base: debit,
    credit_base: credit,
    description: "",
  };
}

function entry(
  overrides: Partial<JournalEntryDto> & { id: string; lines: JournalEntryDto["lines"] },
): JournalEntryDto {
  return {
    entry_number: overrides.id,
    journal_type: "GeneralJournal",
    journal_type_display: "",
    lines: overrides.lines,
    entry_date: "2026-01-01",
    description: overrides.description ?? "",
    status: "Posted",
    total_base_debit: "0",
    total_base_credit: "0",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

/** The single canonical chart: one flat leaf per economic balance. */
function canonicalAccounts(): AccountDto[] {
  return [
    acc({ id: "cash1", code: "1910", name_ar: "النقد والصندوق" }),
    acc({ id: "bank1", code: "1911", name_ar: "البنوك" }),
    acc({ id: "ar1", code: "1912", name_ar: "الذمم المدينة", purpose: "receivable" }),
    acc({ id: "inventory1", code: "1913", name_ar: "المخزون", purpose: "inventory" }),
    acc({ id: "fa1", code: "1114", name_ar: "الأصول الثابتة", purpose: "fixed_asset" }),
    acc({ id: "ap1", code: "2910", name_ar: "الذمم الدائنة", account_type: "Liabilities", purpose: "payable" }),
    acc({ id: "loan1", code: "224", name_ar: "القروض", account_type: "Liabilities" }),
    acc({ id: "cap1", code: "3910", name_ar: "رأس المال", account_type: "Equity" }),
    acc({ id: "re1", code: "3912", name_ar: "أرباح مرحلة", account_type: "Equity" }),
  ];
}

/** Posted opening journal dated 2026-01-01: Dr 465 / Cr 465 — the ONLY GL input. */
function canonicalOpeningJournal(): JournalEntryDto {
  return entry({
    id: "op1",
    journal_type: "AccountOpeningBalance",
    description: "قيد ترحيل رصيد افتتاح الشركة",
    entry_date: "2026-01-01",
    lines: [
      line("cash1", "25", "0"),
      line("bank1", "40", "0"),
      line("ar1", "80", "0"),
      line("inventory1", "120", "0"),
      line("fa1", "200", "0"),
      line("ap1", "0", "70"),
      line("loan1", "0", "50"),
      line("cap1", "0", "300"),
      line("re1", "0", "45"),
    ],
  });
}

describe("Both reports derive from the one authoritative posted GL", () => {
  it("canonical scenario: Trial Balance Dr = Cr and Balance Sheet A 465 = L 120 + E 345 via the shared ledgerTotals", () => {
    const accounts = canonicalAccounts();
    const { ledgerTotals } = computeLedgerTotals(accounts, [canonicalOpeningJournal()]);

    expect(ledgerTotals.get("fa1")?.openingDebit).toBe(200);
    expect(ledgerTotals.get("inventory1")?.openingDebit).toBe(120);
    expect(ledgerTotals.get("cap1")?.openingCredit).toBe(300);
    expect(ledgerTotals.get("re1")?.openingCredit).toBe(45);
    expect(ledgerTotals.get("ap1")?.openingCredit).toBe(70);
    expect(ledgerTotals.get("loan1")?.openingCredit).toBe(50);

    const nodes = computeTreeTotals(accounts, ledgerTotals);
    expect(nodes.reduce((s, n) => s + n.totDebit, 0)).toBe(465);
    expect(nodes.reduce((s, n) => s + n.totCredit, 0)).toBe(465);
    expect(nodes.reduce((s, n) => s + n.endingBalance, 0)).toBe(0);

    const bs = computeBalanceSheet(
      accounts,
      { netProfit: 0, totalDrawings: 0 },
      ledgerTotals,
      { closingInventory: 0 },
    );
    expect(bs.totalFixedAssets).toBe(200);
    expect(bs.totalCurrentAssets).toBe(265);
    expect(bs.totalAssets).toBe(465);
    expect(bs.totalLiabilities).toBe(120);
    expect(bs.totalEquity).toBe(345);
    expect(bs.totalLiabilitiesEquity).toBe(465);
    expect(bs.isBalanced).toBe(true);
  });

  it("fixed assets never inflate: the FA subledger is not a Balance Sheet input — FA stays 200, one row", () => {
    const accounts = canonicalAccounts();
    const { ledgerTotals } = computeLedgerTotals(accounts, [canonicalOpeningJournal()]);

    const bs = computeBalanceSheet(
      accounts,
      { netProfit: 0, totalDrawings: 0 },
      ledgerTotals,
      { closingInventory: 0 },
    );

    const faSection = bs.sections.find((s) => s.id === "fixed-assets")!;
    expect(faSection.rows).toHaveLength(1);
    expect(faSection.rows[0].value).toBe(200);
    expect(bs.totalFixedAssets).toBe(200);
  });

  it("no source is independently added: static opening_balance, partner subledger and AR subledger stay inert", () => {
    const accounts = canonicalAccounts().map((a) => ({ ...a, opening_balance: "99999" }));
    const { ledgerTotals } = computeLedgerTotals(accounts, [canonicalOpeningJournal()]);

    expect(ledgerTotals.get("fa1")?.openingDebit).toBe(200);
    expect(ledgerTotals.get("inventory1")?.openingDebit).toBe(120);
    expect(ledgerTotals.get("cap1")?.openingCredit).toBe(300);

    const bs = computeBalanceSheet(
      accounts,
      { netProfit: 0, totalDrawings: 0 },
      ledgerTotals,
      { closingInventory: 0 },
    );

    const eqRows = bs.sections.find((s) => s.id === "equity")!.rows;
    expect(eqRows.filter((r) => r.label === "رأس المال")).toHaveLength(1);
    expect(eqRows.find((r) => r.label === "رأس المال")!.value).toBe(300);
    expect(bs.totalEquity).toBe(345);
    expect(bs.totalCurrentAssets).toBe(265);
  });

  it("post-cutover range: TB opening column holds the beginning balances and BS totals are identical", () => {
    const accounts = canonicalAccounts();
    const { ledgerTotals } = computeLedgerTotals(
      accounts,
      [canonicalOpeningJournal()],
      "2026-02-01",
      "2026-08-16",
    );

    const nodes = computeTreeTotals(accounts, ledgerTotals);
    expect(nodes.reduce((s, n) => s + n.openingDebit, 0)).toBe(465);
    expect(nodes.reduce((s, n) => s + n.openingCredit, 0)).toBe(465);
    expect(nodes.reduce((s, n) => s + n.periodDebit, 0)).toBe(0);
    expect(nodes.reduce((s, n) => s + n.periodCredit, 0)).toBe(0);

    const bs = computeBalanceSheet(
      accounts,
      { netProfit: 0, totalDrawings: 0 },
      ledgerTotals,
      { closingInventory: 0 },
    );
    expect(bs.totalAssets).toBe(465);
    expect(bs.totalLiabilities).toBe(120);
    expect(bs.totalEquity).toBe(345);
    expect(bs.isBalanced).toBe(true);
  });
});

describe("المخزون Summary parent keeps its own GL line", () => {
  const accounts: AccountDto[] = [
    acc({ id: "p_inv", code: "1204", name_ar: "المخزون", purpose: "inventory" }),
    acc({ id: "c_closing", code: "120401", name_ar: "بضاعة آخر المدة", parent_id: "p_inv" }),
    acc({ id: "cash1", code: "121", name_ar: "الصندوق" }),
    acc({ id: "cap1", code: "311", name_ar: "رأس المال", account_type: "Equity" }),
  ];
  const ledgerTotals = new Map<string, AccountLedgerTotal>([
    ["p_inv", lt({ openingDebit: 120, debit: 120, endingBalance: 120 })],
    ["cash1", lt({ openingDebit: 100, debit: 100, endingBalance: 100 })],
    ["cap1", lt({ openingCredit: 220, credit: 220, endingBalance: -220 })],
  ]);

  it("Balance Sheet shows the مخزون GL 120 even with an empty بضاعة آخر المدة child", () => {
    const bs = computeBalanceSheet(
      accounts,
      { netProfit: 0, totalDrawings: 0 },
      ledgerTotals,
      { closingInventory: 0 },
    );
    expect(bs.totalCurrentAssets).toBe(220);
    const section = bs.sections.find((s) => s.id === "current-assets")!;
    const invRow = section.rows.find((r) => r.label === "المخزون");
    expect(invRow?.value).toBe(120);
    expect(bs.isBalanced).toBe(true);
  });

  it("Trial Balance مخزون parent carries the same own 120 (not a zero rollup)", () => {
    const nodes = computeTreeTotals(accounts, ledgerTotals);
    const invNode = nodes.find((n) => n.id === "p_inv")!;
    expect(invNode.openingDebit).toBe(120);
    expect(invNode.endingBalance).toBe(120);
  });
});