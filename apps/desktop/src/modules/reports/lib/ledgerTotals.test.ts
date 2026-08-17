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
