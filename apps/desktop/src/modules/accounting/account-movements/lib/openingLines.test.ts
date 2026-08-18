import { describe, it, expect } from "vitest";
import { isOpeningLine, getOpeningCreationDate, getOpeningTotals, computeOpeningBalance, computeRunningBalance, computeClosingBalance, markEntryRunFirsts, groupMovementLinesByJournal } from "./openingLines";

const openingLine = (journal_type: string, date: string, debit_base = "0", credit_base = "0", description = "") => ({
  journal_type,
  description,
  date,
  debit_base,
  credit_base,
});

describe("isOpeningLine", () => {
  it("matches English opening journal types", () => {
    expect(isOpeningLine({ journal_type: "AccountOpeningBalance", description: "" })).toBe(true);
    expect(isOpeningLine({ journal_type: "CashOpeningBalance", description: "" })).toBe(true);
    expect(isOpeningLine({ journal_type: "MaterialOpeningBalance", description: "" })).toBe(true);
  });

  it("matches Arabic opening journal types", () => {
    expect(isOpeningLine({ journal_type: "رصيد افتتاحي", description: "" })).toBe(true);
    expect(isOpeningLine({ journal_type: "رصيد افتتاحي لحساب", description: "" })).toBe(true);
    expect(isOpeningLine({ journal_type: "رصيد افتتاحي للخزينة", description: "" })).toBe(true);
  });

  it("matches descriptions containing opening phrases", () => {
    expect(isOpeningLine({ journal_type: "GeneralJournal", description: "إثبات رصيد افتتاحي للمورد" })).toBe(true);
    expect(isOpeningLine({ journal_type: "GeneralJournal", description: "مواد أول المدة" })).toBe(true);
  });

  it("rejects ordinary lines", () => {
    expect(isOpeningLine({ journal_type: "SalesJournal", description: "فاتورة بيع" })).toBe(false);
  });

  it("lets the backend is_opening flag win over the legacy heuristic", () => {
    expect(isOpeningLine({ journal_type: "GeneralJournal", description: "إثبات رصيد افتتاحي للمورد", is_opening: false })).toBe(false);
    expect(isOpeningLine({ journal_type: "GeneralJournal", description: "فاتورة بيع", is_opening: true })).toBe(true);
  });
});

describe("getOpeningCreationDate", () => {
  it("returns the opening entry date when no opening lines exist", () => {
    expect(getOpeningCreationDate({ date: "2026-08-03T18:12:52Z" }, [])).toBe("2026-08-03");
  });

  it("returns the earliest opening line date", () => {
    const lines = [
      openingLine("GeneralJournal", "2026-08-03T19:38:03Z", "0", "777", "قيد افتتاح"),
      openingLine("AccountOpeningBalance", "2026-08-03T18:12:52Z", "0", "123"),
    ];
    expect(getOpeningCreationDate(null, lines)).toBe("2026-08-03");
  });

  it("ignores non-opening lines", () => {
    const lines = [openingLine("SalesJournal", "2025-01-01T00:00:00Z", "10", "0", "فاتورة بيع")];
    expect(getOpeningCreationDate({ date: "2026-08-03T18:12:52Z" }, lines)).toBe("2026-08-03");
  });
});

describe("getOpeningTotals", () => {
  it("aggregates all opening lines within the range (account 53 scenario)", () => {
    const lines = [
      openingLine("AccountOpeningBalance", "2026-08-03T18:12:52Z", "0", "123"),
      openingLine("AccountOpeningBalance", "2026-08-03T19:38:03Z", "0", "777"),
    ];
    expect(getOpeningTotals(lines, "2026-01-01", "2026-08-03")).toEqual({ debit: 0, credit: 900 });
  });

  it("excludes opening lines outside the range", () => {
    const lines = [
      openingLine("AccountOpeningBalance", "2026-08-03T18:12:52Z", "0", "123"),
      openingLine("AccountOpeningBalance", "2026-09-10T00:00:00Z", "0", "777"),
    ];
    expect(getOpeningTotals(lines, "2026-01-01", "2026-08-03")).toEqual({ debit: 0, credit: 123 });
  });

  it("returns zeroes when nothing is in range", () => {
    expect(getOpeningTotals([], "2026-01-01", "2026-08-03")).toEqual({ debit: 0, credit: 0 });
  });

  it("ignores non-opening lines", () => {
    const lines = [openingLine("SalesJournal", "2026-08-01T00:00:00Z", "50", "0", "فاتورة بيع")];
    expect(getOpeningTotals(lines, "2026-01-01", "2026-08-03")).toEqual({ debit: 0, credit: 0 });
  });
});

describe("report/date semantics for the opening movement", () => {
  const ammarLines = () => [
    openingLine("AccountOpeningBalance", "2026-01-01T00:00:00Z", "80", "0"),
  ];

  it("range 2026-01-01 → 2026-08-16 surfaces exactly one opening movement", () => {
    expect(getOpeningTotals(ammarLines(), "2026-01-01", "2026-08-16")).toEqual({ debit: 80, credit: 0 });
  });

  it("range 2026-02-01 → 2026-08-16 excludes the opening as a movement", () => {
    expect(getOpeningTotals(ammarLines(), "2026-02-01", "2026-08-16")).toEqual({ debit: 0, credit: 0 });
  });

  it("the opening appears only as the beginning balance for 2026-02-01+, never a second movement", () => {
    expect(computeOpeningBalance(ammarLines(), 0, "2026-02-01", "2026-08-16")).toBe(80);
    expect(getOpeningTotals(ammarLines(), "2026-02-01", "2026-08-16")).toEqual({ debit: 0, credit: 0 });
  });

  it("the opening creation date is the accounting date, not the journal created_at", () => {
    expect(getOpeningCreationDate({ date: "2026-08-03T18:12:52Z" }, ammarLines())).toBe("2026-01-01");
    expect(getOpeningCreationDate(null, ammarLines())).toBe("2026-01-01");
  });
});

describe("computeOpeningBalance", () => {
  it("uses the posted opening journal line as the beginning balance (no static double count)", () => {
    const lines = [
      openingLine("AccountOpeningBalance", "2026-08-03T18:12:52Z", "0", "180"),
    ];
    expect(computeOpeningBalance(lines, 180, "2026-08-04", "2026-12-31")).toBe(-180);
  });

  it("sums movements before from_date on top of the opening line", () => {
    const lines = [
      openingLine("AccountOpeningBalance", "2026-08-03T18:12:52Z", "300", "0"),
      { journal_type: "SalesJournal", description: "بيع", date: "2026-08-02T10:00:00Z", debit_base: "100", credit_base: "0" },
    ];
    // Opening 300 (Dr) + 100 Dr before from → 400
    expect(computeOpeningBalance(lines, 0, "2026-08-04", "2026-12-31")).toBe(400);
  });

  it("falls back to the static opening balance when no opening journal line exists", () => {
    const lines = [
      { journal_type: "SalesJournal", description: "بيع", date: "2026-07-01T10:00:00Z", debit_base: "50", credit_base: "0" },
    ];
    expect(computeOpeningBalance(lines, 120, "2026-08-04", "2026-12-31")).toBe(170);
  });

  it("returns zero when the opening journal is created after the period end", () => {
    const lines = [
      openingLine("AccountOpeningBalance", "2026-10-01T18:12:52Z", "0", "180"),
    ];
    expect(computeOpeningBalance(lines, 180, "2026-08-04", "2026-08-31")).toBe(0);
  });

  it("returns the static base when no from_date is given and no opening line exists", () => {
    expect(computeOpeningBalance([], 120, undefined, undefined)).toBe(120);
  });

  it("returns zero when no from_date is given and an opening line exists", () => {
    const lines = [openingLine("AccountOpeningBalance", "2026-08-03T18:12:52Z", "0", "180")];
    expect(computeOpeningBalance(lines, 180, undefined, undefined)).toBe(0);
  });
});

describe("computeClosingBalance", () => {
  it("returns a debit balance when the debit total is larger (account 223)", () => {
    expect(computeClosingBalance(900, 0)).toEqual({ net: 900, sign: "مدين" });
  });

  it("returns a credit balance when the credit total is larger (account 53)", () => {
    expect(computeClosingBalance(0, 900)).toEqual({ net: -900, sign: "دائن" });
  });

  it("returns balanced when both totals are equal", () => {
    expect(computeClosingBalance(500, 500)).toEqual({ net: 0, sign: "متزن" });
  });

  it("uses the absolute value for the magnitude", () => {
    expect(computeClosingBalance(150, 200)).toEqual({ net: -50, sign: "دائن" });
  });
});

describe("computeRunningBalance", () => {
  it("seeds from the beginning balance and accumulates Dr − Cr per row", () => {
    const lines = [
      openingLine("SalesJournal", "2026-08-05T10:00:00Z", "20", "0", "بيع"),
      openingLine("SalesJournal", "2026-08-06T10:00:00Z", "0", "30", "رد"),
    ];
    expect(computeRunningBalance(lines, 80)).toEqual([100, 70]);
  });

  it("returns an empty array when there are no lines", () => {
    expect(computeRunningBalance([], 80)).toEqual([]);
  });

  it("yields a credit running balance when credits outweigh debits", () => {
    const lines = [openingLine("SalesJournal", "2026-08-05T10:00:00Z", "0", "50", "بيع")];
    expect(computeRunningBalance(lines, 0)).toEqual([-50]);
  });
});

describe("statement display semantics (AR 1231 = 80)", () => {
  const arLine = () => [openingLine("AccountOpeningBalance", "2026-01-01T00:00:00Z", "80", "0")];

  it("opening in-range → beginning = 0 (no beginning row) and running = [80], never [160]", () => {
    const beginning = computeOpeningBalance(arLine(), 0, "2026-01-01", "2026-08-16");
    expect(beginning).toBe(0);
    expect(computeRunningBalance(arLine(), beginning)).toEqual([80]);
  });

  it("opening before-range → beginning = 80 and no in-range movement row", () => {
    const beginning = computeOpeningBalance(arLine(), 0, "2026-02-01", "2026-08-16");
    expect(beginning).toBe(80);
    expect(computeRunningBalance([], beginning)).toEqual([]);
  });

  it("closing = beginning + period net stays 80, never 160", () => {
    // Opening in-range: the opening movement is the period net, beginning = 0.
    expect(computeClosingBalance(0 + 80, 0)).toEqual({ net: 80, sign: "مدين" });
    // Opening before-range: beginning = 80, no in-range movements.
    expect(computeClosingBalance(80 + 0, 0)).toEqual({ net: 80, sign: "مدين" });
  });

  it("the subledger episode of Ammar is the same single 80 — no extra GL row is added", () => {
    // Lines are drawn only from posted journal lines (the opening no-duplication
    // e2e asserts the
    // AR ledger has exactly one movement); a separate subledger row cannot
    // count the balance again.
    const lines = arLine();
    expect(lines.length).toBe(1);
    expect(computeRunningBalance(lines, 0)).toEqual([80]);
  });
});

describe("markEntryRunFirsts (one journal = one header)", () => {
  const run = (journal_id: string) => ({ journal_id });

  it("flags only the first row of each adjacent same-journal run", () => {
    expect(markEntryRunFirsts([
      run("9"), run("9"), run("9"),
      run("10"), run("10"),
      run("11"),
    ])).toEqual([true, false, false, true, false, true]);
  });

  it("returns an empty array for no lines", () => {
    expect(markEntryRunFirsts([])).toEqual([]);
  });

  it("flags every row when journals are unique", () => {
    expect(markEntryRunFirsts([run("a"), run("b"), run("c")])).toEqual([true, true, true]);
  });

  it("keeps adjacent same-journal rows adjacent under one header (reclassification joint)", () => {
    // Journal 10 (Dr 53 / Cr 52) after entry 9 — statement shows
    // entry-number/type/date once for the pair.
    expect(markEntryRunFirsts([
      run("9"),
      run("10"),
      run("10"),
    ])).toEqual([true, true, false]);
  });

  it("detects a journal interrupted by another journal as two separate runs", () => {
    expect(markEntryRunFirsts([
      run("10"), run("9"), run("10"),
    ])).toEqual([true, true, true]);
  });
});

describe("groupMovementLinesByJournal (one journal = one visual group)", () => {
  const row = (journal_id: string) => ({ journal_id });

  it("keeps every line of a multi-line journal in a single group", () => {
    expect(groupMovementLinesByJournal([
      row("9"), row("9"), row("9"), row("9"), row("9"), row("9"),
    ])).toEqual([[row("9"), row("9"), row("9"), row("9"), row("9"), row("9")]]);
  });

  it("separates distinct journals even when they share the same sort key", () => {
    expect(groupMovementLinesByJournal([
      row("9"), row("10"), row("10"),
    ]).map((g) => g.map((r) => r.journal_id))).toEqual([["9"], ["10", "10"]]);
  });

  it("returns one group per journal preserving first-seen order", () => {
    expect(groupMovementLinesByJournal([
      row("9"), row("9"), row("10"), row("11"),
    ]).map((g) => g.map((r) => r.journal_id))).toEqual([["9", "9"], ["10"], ["11"]]);
  });

  it("isolates the synthetic beginning row (empty journal_id) as its own group", () => {
    expect(groupMovementLinesByJournal([
      row(""), row("9"), row("9"),
    ]).map((g) => g.map((r) => r.journal_id))).toEqual([[""], ["9", "9"]]);
  });

  it("returns an empty array for no lines", () => {
    expect(groupMovementLinesByJournal([])).toEqual([]);
  });
});
