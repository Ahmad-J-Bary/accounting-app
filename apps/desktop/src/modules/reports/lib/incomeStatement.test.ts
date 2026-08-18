import { describe, it, expect } from "vitest";
import { computeIncomeStatement, emptyIncomeStatementData } from "./incomeStatement";
import type { AccountLedgerDto, AccountLedgerLineDto } from "@erp/shared-types";

const filters = { from_date: "2026-01-01", to_date: "2026-08-04" };

function line(overrides: Partial<AccountLedgerLineDto> & { date: string; debit_base: string; credit_base: string }): AccountLedgerLineDto {
  return {
    journal_id: "j1",
    entry_id: "j1",
    entry_number: "1",
    journal_type: "ExpenseVoucher",
    entry_type: "expense_voucher",
    entry_status: "Posted",
    journal_type_display: "سند مصاريف",
    is_opening: false,
    line_id: "l1",
    account_id: "a1",
    source_id: null,
    description: "",
    opposite_account_name: "",
    currency: "",
    fx_rate: "1",
    balance_base: "0",
    debit_original: "0",
    credit_original: "0",
    balance_original: "0",
    ...overrides,
  };
}

function openingLine(date: string, debit_base: string, credit_base = "0", description = "رصيد افتتاحي") {
  return line({ date, debit_base, credit_base, journal_type: "AccountOpeningBalance", entry_type: "account_opening_balance", journal_type_display: "رصيد افتتاحي", is_opening: true, description });
}

function ledger(overrides: Partial<AccountLedgerDto> & { lines?: AccountLedgerLineDto[] }): AccountLedgerDto {
  const { lines = [], ...rest } = overrides;
  return {
    account_id: "e1",
    account_name: "بند مصروف",
    opening_balance_base: "0",
    opening_balance_original: "0",
    opening_entry: null,
    opening_entries: [],
    lines,
    total_debit_base: "0",
    total_credit_base: "0",
    closing_balance_base: "0",
    total_debit_original: "0",
    total_credit_original: "0",
    closing_balance_original: "0",
    ...rest,
  };
}

function computeWith(expenseLedgers: AccountLedgerDto[]) {
  const accounts = expenseLedgers.map((l) => ({
    id: l.account_id,
    code: "433",
    name_ar: l.account_name,
    name_en: "",
    account_type: "Expense",
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
  }));
  return computeIncomeStatement(filters, {
    ...emptyIncomeStatementData,
    expenseAccounts: accounts,
    expenseLedgers: new Map(expenseLedgers.map((l) => [l.account_id, l])),
  });
}

describe("computeIncomeStatement — إجمالي المصاريف", () => {
  it("يُدرج الرصيد الافتتاحي لبند المصروف (بقيود افتتاح) ضمن إجمالي المصاريف", () => {
    const result = computeWith([
      ledger({
        opening_balance_base: "777",
        opening_entries: [
          { entry_number: "3", description: "رصيد افتتاحي مدين للحساب: 777", date: "2026-08-03T21:00:33Z", debit_base: "777", credit_base: "0" },
        ],
      }),
    ]);
    expect(result.totalExpenses).toBe(777);
  });

  it("يجمع رصيد افتتاحي في lines مع حركة فترة دون تكرار الاحتساب", () => {
    const result = computeWith([
      ledger({
        opening_balance_base: "100",
        lines: [
          openingLine("2026-08-03T21:00:33Z", "100"),
          line({ date: "2026-08-04T12:00:00Z", debit_base: "50", credit_base: "0", journal_type: "ExpenseVoucher", description: "سند مصروف" }),
        ],
      }),
    ]);
    expect(result.totalExpenses).toBe(150);
  });

  it("يستخدم الرصيد الثابت (opening_balance_base) عند غياب قيود الافتتاح", () => {
    const result = computeWith([
      ledger({ opening_balance_base: "777", opening_entries: [], lines: [] }),
    ]);
    expect(result.totalExpenses).toBe(777);
  });

  it("يبقي بنود المصاريف العادية ضمن النطاق كما هي", () => {
    const result = computeWith([
      ledger({
        lines: [line({ date: "2026-08-04T12:00:00Z", debit_base: "90", credit_base: "0", journal_type: "ExpenseVoucher", description: "سند مصاريف" })],
      }),
    ]);
    expect(result.totalExpenses).toBe(90);
  });

  it("يستثني قيود الافتتاح التي أُنشئت بعد نهاية الفترة", () => {
    const result = computeWith([
      ledger({
        opening_balance_base: "0",
        opening_entries: [
          { entry_number: "9", description: "رصيد افتتاحي", date: "2026-09-10T00:00:00Z", debit_base: "777", credit_base: "0" },
        ],
      }),
    ]);
    expect(result.totalExpenses).toBe(0);
  });
});
