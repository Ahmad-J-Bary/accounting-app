import { describe, it, expect } from "vitest";
import { computeLedgerTotals } from "./ledgerTotals";
import type { AccountDto, JournalEntryDto } from "@erp/shared-types";

function account(id: string, code: string, account_type: AccountDto["account_type"]): AccountDto {
  return {
    id,
    code,
    name_ar: code,
    name_en: "",
    account_type,
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

describe("computeLedgerTotals — fixed-asset opening appears exactly once", () => {
  const fa = account("fa1", "1115", "Assets");
  const equity = account("eq1", "52", "Equity");

  it("150 + 50 = 200 via the single posted migration aggregate", () => {
    const migration = entry({
      id: "m1",
      journal_type: "AccountOpeningBalance",
      description: "قيد ترحيل رصيد افتتاح الشركة",
      lines: [
        line("fa1", "200", "0"),
        line("eq1", "0", "200"),
      ],
    });

    const { ledgerTotals } = computeLedgerTotals([fa, equity], [migration]);
    expect(ledgerTotals.get("fa1")?.openingDebit).toBe(200);
    expect(ledgerTotals.get("fa1")?.endingBalance).toBe(200);
    expect(ledgerTotals.get("eq1")?.openingCredit).toBe(200);
  });

  it("a legacy Draft FA opening journal is excluded — the GL stays 200, never 400", () => {
    const legacyCarDraft = entry({
      id: "d1",
      journal_type: "GeneralJournal",
      description: "إضافة أصل سابق (أول المدة): سيارة",
      status: "Draft",
      lines: [line("fa1", "150", "0"), line("eq1", "0", "150")],
    });
    const legacyEquipmentDraft = entry({
      id: "d2",
      journal_type: "GeneralJournal",
      description: "إضافة أصل سابق (أول المدة): معدات",
      status: "Draft",
      lines: [line("fa1", "50", "0"), line("eq1", "0", "50")],
    });
    const migration = entry({
      id: "m1",
      journal_type: "AccountOpeningBalance",
      description: "قيد ترحيل رصيد افتتاح الشركة",
      lines: [line("fa1", "200", "0"), line("eq1", "0", "200")],
    });

    const { ledgerTotals } = computeLedgerTotals(
      [fa, equity],
      [legacyCarDraft, legacyEquipmentDraft, migration],
    );
    expect(ledgerTotals.get("fa1")?.openingDebit).toBe(200);
    expect(ledgerTotals.get("fa1")?.endingBalance).toBe(200);
    expect(ledgerTotals.get("eq1")?.openingCredit).toBe(200);
  });
});

describe("computeLedgerTotals — reversal is mathematically neutral", () => {
  const cash = account("cash1", "1910", "Assets");
  const equity = account("eq1", "3910", "Equity");

  it("a posted entry followed by its reversal nets to zero", () => {
    // After `reverse_journal_entry` the ORIGINAL is flipped to Reversed and a
    // separate Posted contra journal (swapped Dr/Cr) carries the reversal id.
    const original = entry({
      id: "m1",
      status: "Reversed",
      lines: [line("cash1", "100", "0"), line("eq1", "0", "100")],
    });
    const reversal = entry({
      id: "r1",
      journal_type: "GeneralJournal",
      reversal_of_entry_id: "m1",
      lines: [line("cash1", "0", "100"), line("eq1", "100", "0")],
    });

    const { ledgerTotals } = computeLedgerTotals([cash, equity], [original, reversal]);
    expect(ledgerTotals.get("cash1")?.endingBalance).toBe(0);
    expect(ledgerTotals.get("eq1")?.endingBalance).toBe(0);
    expect(ledgerTotals.get("cash1")?.debit).toBe(0);
    expect(ledgerTotals.get("eq1")?.credit).toBe(0);
  });

  it("a lone reversal in the posted feed (original no longer posted) is neutral", () => {
    // The reports feed (`list_posted_journal_entries`) only carries Posted rows,
    // so after reversal it contains ONLY the contra journal. That single row
    // must not move any balance — this is the cross-report consistency contract
    // with the backend ledger, which surfaces neither side of the pair.
    const reversal = entry({
      id: "r1",
      journal_type: "GeneralJournal",
      reversal_of_entry_id: "m1",
      lines: [line("cash1", "0", "100"), line("eq1", "100", "0")],
    });

    const { ledgerTotals } = computeLedgerTotals([cash, equity], [reversal]);
    expect(ledgerTotals.get("cash1")?.endingBalance).toBe(0);
    expect(ledgerTotals.get("eq1")?.endingBalance).toBe(0);
  });

  it("a reversal matches the no-posting baseline while other entries still count", () => {
    const original = entry({
      id: "m1",
      status: "Reversed",
      lines: [line("cash1", "100", "0"), line("eq1", "0", "100")],
    });
    const reversal = entry({
      id: "r1",
      journal_type: "GeneralJournal",
      reversal_of_entry_id: "m1",
      lines: [line("cash1", "0", "100"), line("eq1", "100", "0")],
    });
    const unrelated = entry({
      id: "u1",
      lines: [line("cash1", "50", "0"), line("eq1", "0", "50")],
    });

    const withPair = computeLedgerTotals([cash, equity], [original, reversal, unrelated]);
    const withoutPair = computeLedgerTotals([cash, equity], [unrelated]);
    expect(withPair.ledgerTotals.get("cash1")?.endingBalance).toBe(
      withoutPair.ledgerTotals.get("cash1")?.endingBalance,
    );
    expect(withPair.ledgerTotals.get("eq1")?.endingBalance).toBe(-50);
  });
});

describe("computeLedgerTotals — opening journal inside the period is never re-added", () => {
  const fa = account("fa1", "1115", "Assets");
  const equity = account("eq1", "52", "Equity");

  it("static opening_balance is not added on top of the posted opening journal", () => {
    const faWithStatic = { ...fa, opening_balance: "99999" };

    const migration = entry({
      id: "m1",
      journal_type: "AccountOpeningBalance",
      description: "قيد ترحيل رصيد افتتاح الشركة",
      entry_date: "2026-02-05",
      lines: [line("fa1", "200", "0"), line("eq1", "0", "200")],
    });

    const { ledgerTotals } = computeLedgerTotals(
      [faWithStatic, equity],
      [migration],
      "2026-02-01",
      "2026-02-28",
    );
    expect(ledgerTotals.get("fa1")?.openingDebit).toBe(200);
    expect(ledgerTotals.get("fa1")?.endingBalance).toBe(200);
    expect(ledgerTotals.get("eq1")?.openingCredit).toBe(200);
  });
});
