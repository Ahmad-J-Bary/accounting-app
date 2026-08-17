import { describe, it, expect } from "vitest";
import { toJournalLines, journalTwoLineCompare, type JournalRowLine } from "./journal-view";

const makeLine = (
  account_name: string,
  account_code: string,
  debit: number,
  credit: number,
): JournalRowLine => ({
  group_key: "entry",
  id: "entry",
  entry_number: "10",
  journal_type_display: "قيد اليومية",
  status: "Posted",
  description: "ترحيل تصنيف الرصيد المتبقي",
  entry_date: "2026-08-03",
  created_at: "2026-08-03T00:00:00Z",
  account_name,
  account_code,
  groupSortAccount: "منقودة",
  side: debit > 0 ? "debit" : "credit",
  amount_base: debit > 0 ? debit : credit,
  amount_original: 0,
});

describe("toJournalLines (entry-level sort anchor)", () => {
  const residualEntry: any = {
    id: "e10",
    entry_number: "10",
    journal_type: "GeneralJournal",
    journal_type_display: "قيد اليومية",
    status: "Posted",
    description: "ترحيل تصنيف الرصيد المتبقي",
    entry_date: "2026-08-03",
    created_at: "2026-08-03T00:00:00Z",
    lines: [
      { account_id: "a53", account_name: "منقودة", account_code: "53", debit: "45", credit: "0" },
      { account_id: "a52", account_name: "الاحتياطي القانوني", account_code: "52", debit: "0", credit: "45" },
    ],
  };

  it("assigns the SAME groupSortAccount (entry first-account) to every line", () => {
    const [dr, cr] = toJournalLines(residualEntry);
    expect(dr.groupSortAccount).toBe("منقودة");
    expect(cr.groupSortAccount).toBe("منقودة");
  });

  it("keeps both legs of one journal in a single group_key", () => {
    const lines = toJournalLines(residualEntry);
    expect(lines.length).toBe(2);
    expect(lines.every((l) => l.group_key === "e10")).toBe(true);
  });
});

describe("journalTwoLineCompare (group-level account anchor)", () => {
  // Journal 10 — Dr 53 "منقودة" / Cr 52 "الاحتياطي القانوني". Both lines share
  // the entry anchor "منقودة"; the credit leg's own account is different.
  const residualDr = makeLine("منقودة", "53", 45, 0);
  const residualCr = makeLine("الاحتياطي القانوني", "52", 0, 45);
  residualDr.groupSortAccount = "منقودة";
  residualCr.groupSortAccount = "منقودة";

  // Journal 9 (posting) — anchor "شركة أ".
  const e9 = {
    ...makeLine("شركة أ", "100", 10, 0),
    entry_number: "9",
    groupSortAccount: "شركة أ",
  };

  it("returns 0 for the two legs of the same journal under account sort (group stays adjacent)", () => {
    expect(journalTwoLineCompare(residualDr, residualCr, "account", "asc")).toBe(0);
  });

  it("orders journals by their anchor, not by any single line's account", () => {
    const expected = "منقودة".localeCompare("شركة أ", "ar");
    expect(journalTwoLineCompare(residualDr, e9, "account", "asc")).toBe(expected);
    // The credit leg (whose own account differs) compares identically.
    expect(journalTwoLineCompare(residualCr, e9, "account", "asc")).toBe(expected);
  });

  it("honors desc direction for the account anchor", () => {
    expect(journalTwoLineCompare(e9, residualCr, "account", "desc"))
      .toBe(-("شركة أ".localeCompare("منقودة", "ar")));
  });

  it("sorts by entry_number numerically", () => {
    expect(journalTwoLineCompare(residualDr, e9, "entry_number", "asc")).toBeGreaterThan(0);
    expect(journalTwoLineCompare(residualDr, e9, "entry_number", "desc")).toBeLessThan(0);
  });

  it("sorts by entry date", () => {
    const older = { ...e9, entry_date: "2026-01-01" };
    expect(journalTwoLineCompare(older, residualDr, "created_at", "asc")).toBeLessThan(0);
  });
});