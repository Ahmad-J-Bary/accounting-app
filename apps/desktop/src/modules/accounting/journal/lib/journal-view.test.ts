import { describe, it, expect } from "vitest";
import { toJournalLines, journalTwoLineCompare, classifyEntryForReport, partitionJournalEntries, auditGroupKey, deriveJournalTypeDisplay, type JournalRowLine } from "./journal-view";

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

// ---------------------------------------------------------------------------
// Reporting policy: operational vs audit archive split.
// ---------------------------------------------------------------------------
const makeEntry = (overrides: Partial<any>): any => ({
  id: "e1",
  entry_number: "1",
  journal_type: "GeneralJournal",
  journal_type_display: "اليومية العامة",
  status: "Posted",
  description: "قيد اختبار",
  entry_date: "2026-01-01",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  total_base_debit: "0",
  total_base_credit: "0",
  lines: [],
  ...overrides,
});

describe("classifyEntryForReport", () => {
  it("a Posted entry with no reversal relationship is operational", () => {
    expect(classifyEntryForReport(makeEntry({}))).toBe("operational");
  });

  it("a Posted contra journal (reversal_of_entry_id set) is audit, not operational", () => {
    expect(classifyEntryForReport(makeEntry({ reversal_of_entry_id: "e0" }))).toBe("audit");
  });

  it("Reversed, Draft and Cancelled entries are never operational", () => {
    expect(classifyEntryForReport(makeEntry({ status: "Reversed" }))).toBe("audit");
    expect(classifyEntryForReport(makeEntry({ status: "Draft" }))).toBe("audit");
    expect(classifyEntryForReport(makeEntry({ status: "Cancelled" }))).toBe("audit");
  });
});

describe("partitionJournalEntries", () => {
  it("separates the operational posted list from the audit archive", () => {
    const operational = makeEntry({ id: "e1" });
    const contra = makeEntry({ id: "e2", reversal_of_entry_id: "e1" });
    const reversed = makeEntry({ id: "e3", status: "Reversed" });
    const draft = makeEntry({ id: "e4", status: "Draft" });
    const cancelled = makeEntry({ id: "e5", status: "Cancelled" });

    const { operational: ops, audit } = partitionJournalEntries([
      operational, contra, reversed, draft, cancelled,
    ]);

    expect(ops.map((e) => e.id)).toEqual(["e1"]);
    expect(audit.map((e) => e.id)).toEqual(["e2", "e3", "e4", "e5"]);
  });
});

describe("auditGroupKey", () => {
  it("keeps a reversal pair together: the contra points at the original", () => {
    const original = makeEntry({ id: "orig" });
    const contra = makeEntry({ id: "contra", reversal_of_entry_id: "orig" });
    expect(auditGroupKey(contra)).toBe(auditGroupKey(original));
    expect(auditGroupKey(original)).toBe("orig");
  });
});

// ---------------------------------------------------------------------------
// The EXISTING-company Daily Journal holds EXACTLY the two official
// entries (Opening Migration + Residual Classification), both operational, and
// every GL row carries non-blank Entry Number / Entry Type at its group start
// (child lines share the parent entry's metadata — never silently blank).
// ---------------------------------------------------------------------------
const openingLine = (
  account_id: string,
  account_name: string,
  account_code: string,
  debit: string,
  credit: string,
) => ({
  account_id,
  account_name,
  account_code,
  debit,
  credit,
  fx_rate: "1",
  currency: "S",
  debit_base: debit,
  credit_base: credit,
});

const openingMigrationEntry = makeEntry({
  id: "1",
  entry_number: "1",
  journal_type: "AccountOpeningBalance",
  journal_type_display: "قيد افتتاح الشركة",
  description: "قيد ترحيل رصيد افتتاح الشركة",
  entry_date: "2026-01-01",
  lines: [
    openingLine("a1910", "النقد والصندوق", "1910", "25", "0"),
    openingLine("a1911", "البنوك", "1911", "40", "0"),
    openingLine("a1912", "الذمم المدينة", "1912", "80", "0"),
    openingLine("a1913", "المخزون", "1913", "120", "0"),
    openingLine("a1114", "الأصول الثابتة", "1114", "200", "0"),
    openingLine("a2910", "الذمم الدائنة", "2910", "0", "70"),
    openingLine("a224", "القروض", "224", "0", "50"),
    openingLine("a3911", "جاري أحمد", "3911", "0", "180"),
    openingLine("a3912", "جاري محمد", "3912", "0", "120"),
    openingLine("a53", "رصيد افتتاحي", "53", "0", "45"),
  ],
});

const residualClassificationEntry = makeEntry({
  id: "2",
  entry_number: "2",
  journal_type: "GeneralJournal",
  journal_type_display: "اليومية العامة",
  description: "ترحيل تصنيف الرصيد المتبقي",
  entry_date: "2026-01-01",
  lines: [
    openingLine("a53", "رصيد افتتاحي", "53", "45", "0"),
    openingLine("a3913", "أرباح مرحلة", "3913", "0", "45"),
  ],
});

describe("Daily Journal: exactly the two official entries, no blank Entry metadata", () => {
  it("only the Opening Migration and the Residual Classification are operational", () => {
    const { operational, audit } = partitionJournalEntries([
      openingMigrationEntry,
      residualClassificationEntry,
    ]);
    expect(operational.map((e) => e.entry_number)).toEqual(["1", "2"]);
    expect(audit).toEqual([]);
    expect(operational.every((e) => classifyEntryForReport(e) === "operational")).toBe(true);
  });

  it("every GL row (group start included) carries non-blank Entry Number and Entry Type", () => {
    const lines = [
      ...toJournalLines(openingMigrationEntry),
      ...toJournalLines(residualClassificationEntry),
    ];

    // Group starts are exactly the two official entries.
    const groups = lines.filter(
      (l, i) => i === 0 || l.group_key !== lines[i - 1].group_key,
    );
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.entry_number)).toEqual(["1", "2"]);

    // Every line carries the parent entry's non-blank metadata (the table only
    // hides the cell on child rows — the values are never missing).
    for (const l of lines) {
      expect(l.entry_number.trim().length).toBeGreaterThan(0);
      expect(l.journal_type_display.trim().length).toBeGreaterThan(0);
    }

    // The residual journal keeps both legs in one group with its own number.
    const residualLines = toJournalLines(residualClassificationEntry);
    expect(residualLines).toHaveLength(2);
    expect(residualLines.every((l) => l.entry_number === "2")).toBe(true);
    expect(residualLines.every((l) => l.group_key === "2")).toBe(true);
  });

  it("deriveJournalTypeDisplay is non-blank for both official entries", () => {
    expect(deriveJournalTypeDisplay(openingMigrationEntry).trim().length).toBeGreaterThan(0);
    expect(deriveJournalTypeDisplay(residualClassificationEntry).trim().length).toBeGreaterThan(0);
  });
});