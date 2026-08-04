import { describe, it, expect } from "vitest";
import { isOpeningLine, getOpeningCreationDate, getOpeningTotals, computeClosingBalance, openingEntriesToLines } from "./openingLines";

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
    expect(getOpeningTotals(lines, [], "2026-01-01", "2026-08-03")).toEqual({ debit: 0, credit: 900 });
  });

  it("aggregates all opening entries across children (account 223 scenario)", () => {
    const entries = [
      { date: "2026-08-03T18:12:52Z", debit_base: "123", credit_base: "0" },
      { date: "2026-08-03T19:38:03Z", debit_base: "777", credit_base: "0" },
    ];
    expect(getOpeningTotals([], entries, "2026-01-01", "2026-08-03")).toEqual({ debit: 900, credit: 0 });
  });

  it("aggregates additional opening balances added to one account", () => {
    const entries = [
      { date: "2026-08-03T18:12:52Z", debit_base: "123", credit_base: "0" },
      { date: "2026-08-10T09:00:00Z", debit_base: "456", credit_base: "0" },
    ];
    expect(getOpeningTotals([], entries, "2026-01-01", "2026-08-03")).toEqual({ debit: 123, credit: 0 });
  });

  it("includes opening entry amounts", () => {
    const openingEntry = { date: "2026-08-03T18:12:52Z", debit_base: "123", credit_base: "0" };
    expect(getOpeningTotals([], [openingEntry], "2026-01-01", "2026-08-03")).toEqual({ debit: 123, credit: 0 });
  });

  it("adds opening entry amounts on top of opening lines (caller avoids overlap)", () => {
    const lines = [openingLine("AccountOpeningBalance", "2026-08-03T18:12:52Z", "123", "0")];
    const openingEntry = { date: "2026-08-03T18:12:52Z", debit_base: "123", credit_base: "0" };
    expect(getOpeningTotals(lines, [openingEntry], "2026-01-01", "2026-08-03")).toEqual({ debit: 246, credit: 0 });
  });

  it("excludes opening lines outside the range", () => {
    const lines = [
      openingLine("AccountOpeningBalance", "2026-08-03T18:12:52Z", "0", "123"),
      openingLine("AccountOpeningBalance", "2026-09-10T00:00:00Z", "0", "777"),
    ];
    expect(getOpeningTotals(lines, [], "2026-01-01", "2026-08-03")).toEqual({ debit: 0, credit: 123 });
  });

  it("excludes opening entries outside the range", () => {
    const openingEntry = { date: "2026-09-10T00:00:00Z", debit_base: "777", credit_base: "0" };
    expect(getOpeningTotals([], [openingEntry], "2026-01-01", "2026-08-03")).toEqual({ debit: 0, credit: 0 });
  });

  it("ignores non-opening lines", () => {
    const lines = [openingLine("SalesJournal", "2026-08-01T00:00:00Z", "50", "0", "فاتورة بيع")];
    expect(getOpeningTotals(lines, [], "2026-01-01", "2026-08-03")).toEqual({ debit: 0, credit: 0 });
  });

  it("returns zeroes when nothing is in range", () => {
    expect(getOpeningTotals([], [], "2026-01-01", "2026-08-03")).toEqual({ debit: 0, credit: 0 });
  });
});

describe("openingEntriesToLines", () => {
  it("converts each opening entry into a line detected as opening", () => {
    const entries = [
      { entry_number: "1", description: "رصيد افتتاحي عميل", date: "2026-08-03T18:12:52Z", debit_base: "111", credit_base: "0" },
      { entry_number: "2", description: "رصيد افتتاحي مورد", date: "2026-08-03T19:00:00Z", debit_base: "0", credit_base: "555" },
    ];
    const lines = openingEntriesToLines(entries);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      entry_number: "1",
      description: "رصيد افتتاحي عميل",
      date: "2026-08-03T18:12:52Z",
      debit_base: "111",
      credit_base: "0",
      journal_type: "رصيد افتتاحي",
    });
    expect(lines.every((l) => isOpeningLine(l))).toBe(true);
  });

  it("returns an empty array when there are no opening entries", () => {
    expect(openingEntriesToLines([])).toEqual([]);
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
