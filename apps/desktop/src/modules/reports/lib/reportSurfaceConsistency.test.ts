import { describe, it, expect } from "vitest";
import { computeLedgerTotals } from "./ledgerTotals";
import type { AccountLedgerTotal } from "./ledgerTotals";
import { computeTreeTotals } from "./trialBalance";
import { computeBalanceSheet } from "./balanceSheet";
import {
  partitionJournalEntries,
  classifyEntryForReport,
  auditGroupKey,
} from "@modules/accounting/journal/lib/journal-view";
import type { AccountDto, JournalEntryDto } from "@erp/shared-types";

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

/** The one authoritative chart: every GL account that the opening + residual
 * touch, flat leaves (no parent/child rollup involved). */
function canonicalAccounts(): AccountDto[] {
  return [
    acc({ id: "cash1", code: "1910", name_ar: "النقد والصندوق" }),
    acc({ id: "bank1", code: "1911", name_ar: "البنوك" }),
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

// ---------------------------------------------------------------------------
// The FULL register exactly as the existing company's daily journal holds it:
//   1-2  Draft legacy fixed-asset opening prep journals (never posted)
//   3-8  three reversal pairs — a Reversed temporary prep original + its
//        Posted contra journal, each linked via reversal_of_entry_id
//   9    Opening Migration (AccountOpeningBalance, Dr 465 / Cr 465)
//   10   Residual Classification (GeneralJournal, Dr 45 / Cr 45)
// Every surface must read the SAME canonical source (Posted entries + lines of
// the two official events) but present it differently; the audit history must
// NEVER leak a cent into GL / TB / BS even though it is present in the feed.
// ---------------------------------------------------------------------------
function fullRegister(): JournalEntryDto[] {
  return [
    entry({
      id: "e1",
      entry_number: "1",
      status: "Draft",
      source_id: "draft_fa_car",
      description: "إضافة أصل سابق (أول المدة): سيارة",
      lines: [line("fa1", "150", "0"), line("obe1", "0", "150")],
    }),
    entry({
      id: "e2",
      entry_number: "2",
      status: "Draft",
      source_id: "draft_fa_equipment",
      description: "إضافة أصل سابق (أول المدة): معدات",
      lines: [line("fa1", "50", "0"), line("obe1", "0", "50")],
    }),
    entry({
      id: "e3",
      entry_number: "3",
      status: "Reversed",
      source_id: "legacy_customer_opening",
      description: "قيد ترحيل رصيد افتتاح (قديم): عميل",
      lines: [line("ar1", "80", "0"), line("obe1", "0", "80")],
    }),
    entry({
      id: "e4",
      entry_number: "4",
      status: "Reversed",
      source_id: "legacy_bank_opening",
      description: "قيد ترحيل رصيد افتتاح (قديم): بنك",
      lines: [line("bank1", "40", "0"), line("obe1", "0", "40")],
    }),
    entry({
      id: "e5",
      entry_number: "5",
      status: "Reversed",
      source_id: "legacy_cash_opening",
      description: "قيد ترحيل رصيد افتتاح (قديم): نقد",
      lines: [line("cash1", "25", "0"), line("obe1", "0", "25")],
    }),
    entry({
      id: "e6",
      entry_number: "6",
      reversal_of_entry_id: "e5",
      source_id: "legacy_cash_opening_contra",
      description: "عكس قيد الافتتاح القديم: نقد",
      lines: [line("obe1", "25", "0"), line("cash1", "0", "25")],
    }),
    entry({
      id: "e7",
      entry_number: "7",
      reversal_of_entry_id: "e4",
      source_id: "legacy_bank_opening_contra",
      description: "عكس قيد الافتتاح القديم: بنك",
      lines: [line("obe1", "40", "0"), line("bank1", "0", "40")],
    }),
    entry({
      id: "e8",
      entry_number: "8",
      reversal_of_entry_id: "e3",
      source_id: "legacy_customer_opening_contra",
      description: "عكس قيد الافتتاح القديم: عميل",
      lines: [line("obe1", "80", "0"), line("ar1", "0", "80")],
    }),
    entry({
      id: "e9",
      entry_number: "9",
      journal_type: "AccountOpeningBalance",
      source_id: "opening_balance:existing-company-migration",
      description: "قيد ترحيل رصيد افتتاح الشركة",
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
    }),
    entry({
      id: "e10",
      entry_number: "10",
      source_id: "residual_classification:existing-company-migration",
      description: "ترحيل تصنيف الرصيد المتبقي",
      lines: [line("obe1", "45", "0"), line("re1", "0", "45")],
    }),
  ];
}

function officialOnly(): JournalEntryDto[] {
  return fullRegister().filter((e) => e.id === "e9" || e.id === "e10");
}

describe("PHASE 7 — every surface reads the same accounting source", () => {
  it("General Journal: the full register partitions into exactly [9, 10] operational and the complete audit history", () => {
    const register = fullRegister();
    const { operational, audit } = partitionJournalEntries(register);

    expect(operational.map((e) => e.entry_number)).toEqual(["9", "10"]);
    expect(operational.every((e) => classifyEntryForReport(e) === "operational")).toBe(true);

    // The complete non-operational history: Drafts 1-2 and BOTH parties of
    // every reversal pair (Reversed originals 3-5 AND their contras 6-8).
    expect(audit.map((e) => e.entry_number)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(audit.map((e) => classifyEntryForReport(e))).toEqual(Array(8).fill("audit"));

    // A reversal is a relationship: the contra groups under its original.
    for (const [orig, contra] of [["e3", "e8"], ["e4", "e7"], ["e5", "e6"]] as const) {
      expect(auditGroupKey(register.find((e) => e.id === contra)!)).toBe(
        auditGroupKey(register.find((e) => e.id === orig)!),
      );
      expect(auditGroupKey(register.find((e) => e.id === contra)!)).toBe(orig);
    }
  });

  it("General Ledger: the mixed register leaves every account at its canonical amount", () => {
    const { ledgerTotals } = computeLedgerTotals(canonicalAccounts(), fullRegister());

    expect(ledgerTotals.get("cash1")).toEqual(lt({ openingDebit: 25, debit: 25, endingBalance: 25 }));
    expect(ledgerTotals.get("bank1")).toEqual(lt({ openingDebit: 40, debit: 40, endingBalance: 40 }));
    expect(ledgerTotals.get("ar1")).toEqual(lt({ openingDebit: 80, debit: 80, endingBalance: 80 }));
    expect(ledgerTotals.get("inventory1")).toEqual(lt({ openingDebit: 120, debit: 120, endingBalance: 120 }));
    expect(ledgerTotals.get("fa1")).toEqual(lt({ openingDebit: 200, debit: 200, endingBalance: 200 }));
    expect(ledgerTotals.get("ap1")).toEqual(lt({ openingCredit: 70, credit: 70, endingBalance: -70 }));
    expect(ledgerTotals.get("loan1")).toEqual(lt({ openingCredit: 50, credit: 50, endingBalance: -50 }));
    expect(ledgerTotals.get("ahmad1")).toEqual(lt({ openingCredit: 180, credit: 180, endingBalance: -180 }));
    expect(ledgerTotals.get("mohammad1")).toEqual(lt({ openingCredit: 120, credit: 120, endingBalance: -120 }));
    expect(ledgerTotals.get("obe1")).toEqual(lt({ endingBalance: 0 }));
    expect(ledgerTotals.get("re1")).toEqual(lt({ openingCredit: 45, credit: 45, endingBalance: -45 }));
  });

  it("the full register and the official-only feed produce IDENTICAL ledger totals", () => {
    const mixed = computeLedgerTotals(canonicalAccounts(), fullRegister());
    const official = computeLedgerTotals(canonicalAccounts(), officialOnly());

    for (const account of canonicalAccounts()) {
      const a = mixed.ledgerTotals.get(account.id);
      const b = official.ledgerTotals.get(account.id);
      expect(a).toEqual(b);
    }
    expect(mixed.ledgerTotals.get("fa1")?.openingDebit).toBe(200);
  });

  it("Trial Balance from the mixed register stays balanced at 465 = 465", () => {
    const { ledgerTotals } = computeLedgerTotals(canonicalAccounts(), fullRegister());
    const nodes = computeTreeTotals(canonicalAccounts(), ledgerTotals);

    expect(nodes.reduce((s, n) => s + n.totDebit, 0)).toBe(465);
    expect(nodes.reduce((s, n) => s + n.totCredit, 0)).toBe(465);
    expect(nodes.reduce((s, n) => s + n.endingBalance, 0)).toBe(0);
  });

  it("Balance Sheet from the mixed register stays balanced at 465 = 120 + 345", () => {
    const { ledgerTotals } = computeLedgerTotals(canonicalAccounts(), fullRegister());
    const bs = computeBalanceSheet(
      canonicalAccounts(),
      { netProfit: 0, totalDrawings: 0 },
      ledgerTotals,
      { closingInventory: 0 },
    );

    expect(bs.totalAssets).toBe(465);
    expect(bs.totalLiabilities).toBe(120);
    expect(bs.totalEquity).toBe(345);
    expect(bs.totalLiabilitiesEquity).toBe(465);
    expect(bs.totalFixedAssets).toBe(200);
    expect(bs.totalCurrentAssets).toBe(265);
    expect(bs.isBalanced).toBe(true);
  });
});