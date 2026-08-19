import { describe, it, expect } from "vitest";
import { computeDashboardKpis } from "./gl-kpis";
import type { JournalEntryDto, JournalLineDto } from "@erp/shared-types";

const makeLine = (
  accountPurpose: string | undefined,
  accountType: string | undefined,
  debit: number,
  credit: number,
): JournalLineDto => ({
  account_id: "a1",
  account_code: "1001",
  account_name: "حساب",
  account_purpose: accountPurpose,
  account_type: accountType,
  partner_id: undefined,
  currency: "S",
  fx_rate: "1",
  debit: String(debit),
  credit: String(credit),
  debit_base: String(debit),
  credit_base: String(credit),
  description: "",
});

const makeEntry = (overrides: Partial<JournalEntryDto>): JournalEntryDto => ({
  id: "e1",
  entry_number: "1",
  journal_type: "GeneralJournal",
  journal_type_display: "اليومية العامة",
  source_id: undefined,
  source_type: undefined,
  reversal_of_entry_id: undefined,
  lines: [],
  entry_date: "2026-08-01",
  description: "قيد",
  status: "Posted",
  total_base_debit: "0",
  total_base_credit: "0",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  ...overrides,
});

const entry = (lines: JournalLineDto[], overrides: Partial<JournalEntryDto> = {}) =>
  makeEntry({ lines, ...overrides });

describe("computeDashboardKpis (GL-driven tiles)", () => {
  it("computes sales from credit-normal Revenue flows only", () => {
    const kpis = computeDashboardKpis([
      entry([
        makeLine(undefined, "Revenue", 100, 600),
        makeLine(undefined, "Revenue", 50, 0),
      ]),
    ]);
    expect(kpis.sales).toBe(450);
    expect(kpis.purchases).toBe(0);
  });

  it("computes purchases as the magnitude of debit-normal Expenses flows", () => {
    const kpis = computeDashboardKpis([
      entry([
        makeLine(undefined, "Expenses", 0, 30), // credit reduces spend
        makeLine(undefined, "Expenses", 200, 0),
      ]),
    ]);
    expect(kpis.purchases).toBe(170);
  });

  it("nets cash from Bank and General purposes with the normal balance sign", () => {
    const kpis = computeDashboardKpis([
      entry([
        // Bank asset: debit-normal → net = debit − credit
        makeLine("bank", "Assets", 500, 100),
        // General cash account (asset): debit-normal
        makeLine("general", "Assets", 350, 100),
      ]),
    ]);
    expect(kpis.bank).toBe(400);
    expect(kpis.cash).toBe(250);
  });

  it("rolls receivable / payable positions from their purposes", () => {
    const kpis = computeDashboardKpis([
      entry([
        makeLine("receivable", "Assets", 800, 150),
        makeLine("payable", "Liabilities", 60, 400),
      ]),
    ]);
    expect(kpis.receivables).toBe(650);
    expect(kpis.payables).toBe(340);
  });

  it("computes loan balances from loan-purpose accounts", () => {
    const kpis = computeDashboardKpis([
      entry([
        makeLine("loan", "Liabilities", 60, 400),
        makeLine("loan", "Liabilities", 0, 50),
      ]),
    ]);
    expect(kpis.loans).toBe(390);
  });

  it("assigns a credit normal sign to payable purpose even without account_type", () => {
    // Fallback: payable → Liabilities → credit-normal.
    const kpis = computeDashboardKpis([
      entry([makeLine("payable", undefined, 60, 400)]),
    ]);
    expect(kpis.payables).toBe(340);
    expect(kpis.receivables).toBe(0);
  });

  it("never counts Draft, Cancelled, Reversed originals or reversal contra journals", () => {
    const operational = entry([
      makeLine("receivable", "Assets", 100, 0),
      makeLine("general", "Assets", 100, 0),
    ]);
    const kpis = computeDashboardKpis([
      operational,
      // Reversed original — same lines, must be excluded.
      entry([
        makeLine("receivable", "Assets", 100, 0),
        makeLine("general", "Assets", 100, 0),
      ], { status: "Reversed" }),
      // Posted contra of a reversal pair — must be excluded.
      entry([
        makeLine("receivable", "Assets", 100, 0),
        makeLine("general", "Assets", 100, 0),
      ], { reversal_of_entry_id: "e-rev-original" }),
      entry([
        makeLine("receivable", "Assets", 100, 0),
        makeLine("general", "Assets", 100, 0),
      ], { status: "Draft" }),
      entry([
        makeLine("receivable", "Assets", 100, 0),
        makeLine("general", "Assets", 100, 0),
      ], { status: "Cancelled" }),
    ]);
    expect(kpis.receivables).toBe(100);
    expect(kpis.cash).toBe(100);
  });

  it("builds a monthly income series keyed by YYYY-MM", () => {
    const kpis = computeDashboardKpis([
      entry([
        makeLine(undefined, "Revenue", 0, 300),
        makeLine(undefined, "Expenses", 120, 0),
      ], { entry_date: "2026-06-15" }),
      entry([
        makeLine(undefined, "Revenue", 20, 0),
        makeLine(undefined, "Expenses", 0, 10),
      ], { entry_date: "2026-06-20" }),
      entry([
        makeLine(undefined, "Revenue", 0, 40),
      ], { entry_date: "2026-07-02" }),
    ]);
    expect(kpis.monthly).toEqual([
      { yearMonth: "2026-06", revenue: 280, expenses: 110 },
      { yearMonth: "2026-07", revenue: 40, expenses: 0 },
    ]);
  });
});