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

/** The Phase 7 RESIDUAL chart: the two partner-capital accounts, the OBE 53
 * control account and the Retained Earnings target, plus the operating items. */
function residualAccounts(): AccountDto[] {
  return [
    acc({ id: "cash1", code: "1910", name_ar: "النقد والصندوق" }),
    acc({ id: "bank1", code: "1911", name_ar: "البنوك", purpose: "bank" }),
    acc({ id: "ar1", code: "1912", name_ar: "الذمم المدينة", purpose: "receivable" }),
    acc({ id: "inventory1", code: "1913", name_ar: "المخزون", purpose: "inventory" }),
    acc({ id: "fa1", code: "1114", name_ar: "الأصول الثابتة", purpose: "fixed_asset" }),
    acc({ id: "ap1", code: "2910", name_ar: "الذمم الدائنة", account_type: "Liabilities", purpose: "payable" }),
    acc({ id: "loan1", code: "224", name_ar: "القروض", account_type: "Liabilities" }),
    acc({ id: "ahmad1", code: "3911", name_ar: "جاري أحمد", account_type: "Equity", purpose: "partner_capital" }),
    acc({ id: "mohammad1", code: "3912", name_ar: "جاري محمد", account_type: "Equity", purpose: "partner_capital" }),
    acc({ id: "obe1", code: "53", name_ar: "رصيد افتتاحي", account_type: "Equity", purpose: "opening_balance_equity" }),
    acc({ id: "re1", code: "3913", name_ar: "أرباح مرحلة", account_type: "Equity", purpose: "retained_earnings" }),
  ];
}

/** Opening Migration (AccountOpeningBalance, Dr 465 / Cr 465 incl. OBE 53).
 * No Retained Earnings line — the residual carries it. */
function openingMigrationJournal(): JournalEntryDto {
  return entry({
    id: "1",
    entry_number: "1",
    source_id: "opening_balance:phase7-migration",
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
      line("ahmad1", "0", "180"),
      line("mohammad1", "0", "120"),
      line("obe1", "0", "45"),
    ],
  });
}

/** Residual Classification (GeneralJournal, Dr 53 45 / Cr Retained 45). */
function residualJournal(): JournalEntryDto {
  return entry({
    id: "2",
    entry_number: "2",
    source_id: "residual_classification:phase7-migration",
    description: "ترحيل تصنيف الرصيد المتبقي",
    entry_date: "2026-01-01",
    lines: [
      line("obe1", "45", "0"),
      line("re1", "0", "45"),
    ],
  });
}

describe("Phase 7 — residual classification: TB Dr=Cr and BS 465 = 120 + 345 from the two official entries", () => {
  it("canonical verdict: every account exactly once, RE arrives via the residual, OBE nets to zero", () => {
    const accounts = residualAccounts();
    const { ledgerTotals } = computeLedgerTotals(accounts, [openingMigrationJournal(), residualJournal()]);

    // Each operating / equity account holds its amount exactly once.
    expect(ledgerTotals.get("cash1")?.openingDebit).toBe(25);
    expect(ledgerTotals.get("bank1")?.openingDebit).toBe(40);
    expect(ledgerTotals.get("ar1")?.openingDebit).toBe(80);
    expect(ledgerTotals.get("inventory1")?.openingDebit).toBe(120);
    expect(ledgerTotals.get("fa1")?.openingDebit).toBe(200);
    expect(ledgerTotals.get("ap1")?.openingCredit).toBe(70);
    expect(ledgerTotals.get("loan1")?.openingCredit).toBe(50);
    expect(ledgerTotals.get("ahmad1")?.openingCredit).toBe(180);
    expect(ledgerTotals.get("mohammad1")?.openingCredit).toBe(120);

    // OBE 53: Cr 45 from the opening + Dr 45 from the residual -> nets zero.
    expect(ledgerTotals.get("obe1")?.openingCredit).toBe(0);
    expect(ledgerTotals.get("obe1")?.openingDebit).toBe(0);
    expect(ledgerTotals.get("obe1")?.endingBalance).toBe(0);

    // Retained Earnings arrives ONLY via the residual journal (opening column,
    // the official opening position — never an operational period movement).
    expect(ledgerTotals.get("re1")?.openingDebit).toBe(0);
    expect(ledgerTotals.get("re1")?.openingCredit).toBe(45);
    expect(ledgerTotals.get("re1")?.periodCredit).toBe(0);
    expect(ledgerTotals.get("re1")?.endingBalance).toBe(-45);

    // Trial Balance: Debit = Credit across the whole feed.
    const nodes = computeTreeTotals(accounts, ledgerTotals);
    expect(nodes.reduce((s, n) => s + n.totDebit, 0)).toBe(465);
    expect(nodes.reduce((s, n) => s + n.totCredit, 0)).toBe(465);
    expect(nodes.reduce((s, n) => s + n.endingBalance, 0)).toBe(0);

    // Balance Sheet: Assets 465 = Liabilities 120 + Equity 345.
    const bs = computeBalanceSheet(
      accounts,
      { netProfit: 0, totalDrawings: 0 },
      ledgerTotals,
      { closingInventory: 0 },
    );
    expect(bs.totalAssets).toBe(465);
    expect(bs.totalLiabilities).toBe(120);
    expect(bs.totalEquity).toBe(345);
    expect(bs.totalLiabilitiesEquity).toBe(465);
    expect(bs.isBalanced).toBe(true);
  });

  it("post-cutover range: opening column holds the beginning balances and BS totals are identical", () => {
    const accounts = residualAccounts();
    const { ledgerTotals } = computeLedgerTotals(
      accounts,
      [openingMigrationJournal(), residualJournal()],
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

  it("no source is independently added: static opening_balance and sub-ledgers stay inert", () => {
    const accounts = residualAccounts().map((a) => ({ ...a, opening_balance: "99999" }));
    const { ledgerTotals } = computeLedgerTotals(accounts, [openingMigrationJournal(), residualJournal()]);

    expect(ledgerTotals.get("fa1")?.openingDebit).toBe(200);
    expect(ledgerTotals.get("ahmad1")?.openingCredit).toBe(180);
    expect(ledgerTotals.get("mohammad1")?.openingCredit).toBe(120);
    expect(ledgerTotals.get("re1")?.openingCredit).toBe(45);

    const bs = computeBalanceSheet(
      accounts,
      { netProfit: 0, totalDrawings: 0 },
      ledgerTotals,
      { closingInventory: 0 },
    );
    expect(bs.totalAssets).toBe(465);
    expect(bs.totalEquity).toBe(345);
    expect(bs.totalCurrentAssets).toBe(265);
  });

  it("per-account GL appears exactly once: ledger totals never double the partner split", () => {
    const accounts = residualAccounts();
    const { ledgerTotals } = computeLedgerTotals(
      accounts,
      [openingMigrationJournal(), residualJournal()],
      "2026-02-01",
      "2026-08-16",
    );

    // Each partner account is one line, not a doubled 360/240 rollup.
    expect(ledgerTotals.get("ahmad1")).toEqual(lt({ openingCredit: 180, credit: 180, endingBalance: -180 }));
    expect(ledgerTotals.get("mohammad1")).toEqual(lt({ openingCredit: 120, credit: 120, endingBalance: -120 }));
    expect(ledgerTotals.get("ar1")).toEqual(lt({ openingDebit: 80, debit: 80, endingBalance: 80 }));
    // Combined partner capital reads 300 (180 + 120), the checklist's 300.
    const partnerCapital = residualAccounts()
      .filter((a) => a.id === "ahmad1" || a.id === "mohammad1")
      .reduce((s, a) => s + (ledgerTotals.get(a.id)?.endingBalance ?? 0), 0);
    expect(partnerCapital).toBe(-300);
  });
});