import { describe, it, expect } from "vitest";
import { toJournalLines, toJournalLinesSingleLine, reversalEntryNumber, journalTwoLineCompare, classifyEntryForReport, partitionJournalEntries, auditGroupKey, deriveJournalTypeDisplay, type JournalRowLine } from "./journal-view";
import { hasAccountingEffect, isOfficialJournalEntry, isAuditEntry, isPostedLedgerEntry } from "@modules/reports/lib/report-policies";

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

/** A JournalLineDto carrying a real non-zero accounting effect. */
const makeLineDto = (account_id: string, debit: string, credit: string) => ({
  account_id,
  account_code: "",
  currency: "S",
  fx_rate: "1",
  debit,
  credit,
  debit_base: debit,
  credit_base: credit,
  description: "",
});

/** A Posted, no-reversal entry with an accounting effect (the default shape). */
const makeOperationalEntry = (overrides: Partial<any> = {}) =>
  makeEntry({
    lines: [makeLineDto("a1", "10", "0"), makeLineDto("a2", "0", "10")],
    ...overrides,
  });

describe("classifyEntryForReport", () => {
  it("a Posted entry with no reversal relationship and an effect is operational", () => {
    expect(classifyEntryForReport(makeOperationalEntry())).toBe("operational");
  });

  it("a Posted contra journal (reversal_of_entry_id set) is audit, not operational", () => {
    expect(classifyEntryForReport(makeOperationalEntry({ reversal_of_entry_id: "e0" }))).toBe("audit");
  });

  it("Reversed, Draft and Cancelled entries are never operational", () => {
    expect(classifyEntryForReport(makeOperationalEntry({ status: "Reversed" }))).toBe("audit");
    expect(classifyEntryForReport(makeOperationalEntry({ status: "Draft" }))).toBe("audit");
    expect(classifyEntryForReport(makeOperationalEntry({ status: "Cancelled" }))).toBe("audit");
  });
});

describe("partitionJournalEntries", () => {
  it("separates the operational posted list from the audit archive", () => {
    const operational = makeOperationalEntry({ id: "e1" });
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

// ---------------------------------------------------------------------------
// PHASE 3 — explicit report policies: the official GENERAL JOURNAL feed, the
// separated AUDIT archive, and the posted-ledger policy (GL / TB / BS) each
// name their own predicate. No generic filter is shared blindly.
// ---------------------------------------------------------------------------
describe("hasAccountingEffect (final Posted Residual Classification policy)", () => {
  const zeroLine = (debit: string, credit: string) => ({
    account_id: "a53",
    account_code: "53",
    debit,
    credit,
    fx_rate: "1",
    currency: "S",
    debit_base: debit,
    credit_base: credit,
  });

  it("the real residual classification (Dr 53 / Cr 52) has an accounting effect", () => {
    expect(hasAccountingEffect(residualClassificationEntry)).toBe(true);
  });

  it("a Posted residual with all-zero lines has NO accounting effect", () => {
    const zeroEffect = makeEntry({ id: "e-zero", status: "Posted", lines: [zeroLine("0", "0")] });
    expect(hasAccountingEffect(zeroEffect)).toBe(false);
  });

  it("an entry with no lines has no accounting effect", () => {
    expect(hasAccountingEffect(makeEntry({ id: "e-empty" }))).toBe(false);
  });
});

describe("explicit report policies (PHASE 3)", () => {
  it("GENERAL JOURNAL: Draft / Cancelled / Reversed / contra / zero-effect are never official", () => {
    expect(isOfficialJournalEntry(makeOperationalEntry())).toBe(true);
    expect(isOfficialJournalEntry(makeOperationalEntry({ status: "Draft" }))).toBe(false);
    expect(isOfficialJournalEntry(makeOperationalEntry({ status: "Cancelled" }))).toBe(false);
    expect(isOfficialJournalEntry(makeOperationalEntry({ status: "Reversed" }))).toBe(false);
    expect(isOfficialJournalEntry(makeOperationalEntry({ reversal_of_entry_id: "e0" }))).toBe(false);
    expect(isOfficialJournalEntry(makeEntry({ status: "Posted", lines: [] }))).toBe(false);
  });

  it("GENERAL JOURNAL: final Opening Migration and Residual WITH effect are official", () => {
    expect(isOfficialJournalEntry(openingMigrationEntry)).toBe(true);
    expect(isOfficialJournalEntry(residualClassificationEntry)).toBe(true);
  });

  it("AUDIT: everything non-official is archived (Draft / Cancelled / Reversed / contra)", () => {
    expect(isAuditEntry(makeOperationalEntry({ status: "Draft" }))).toBe(true);
    expect(isAuditEntry(makeOperationalEntry({ status: "Cancelled" }))).toBe(true);
    expect(isAuditEntry(makeOperationalEntry({ status: "Reversed" }))).toBe(true);
    expect(isAuditEntry(makeOperationalEntry({ reversal_of_entry_id: "e0" }))).toBe(true);
    expect(isAuditEntry(makeOperationalEntry())).toBe(false);
  });

  it("POSTED-LEDGER (GL / TB / BS): Posted with no reversal relationship", () => {
    expect(isPostedLedgerEntry(makeEntry({}))).toBe(true);
    expect(isPostedLedgerEntry(makeEntry({ status: "Draft" }))).toBe(false);
    expect(isPostedLedgerEntry(makeEntry({ status: "Cancelled" }))).toBe(false);
    expect(isPostedLedgerEntry(makeEntry({ status: "Reversed" }))).toBe(false);
    expect(isPostedLedgerEntry(makeEntry({ reversal_of_entry_id: "e0" }))).toBe(false);
  });

  it("a zero-effect Posted residual is archived — never a blank operational row", () => {
    const zeroEffect = makeEntry({ id: "e-zero", status: "Posted", lines: [] });
    expect(classifyEntryForReport(zeroEffect)).toBe("audit");
    const { audit } = partitionJournalEntries([residualClassificationEntry, zeroEffect]);
    expect(audit.map((e) => e.id)).toEqual(["e-zero"]);
  });
});

// ---------------------------------------------------------------------------
// PHASE 4 — reversal display & semantics: a reversal is a relationship
// (reversal_of_entry_id), never an entry type. Display labels are derived from
// state — the contra journal AND the Reversed original carry the " — معكوس"
// suffix; the audit archive shows each party's counterpart entry number.
// ---------------------------------------------------------------------------
describe("deriveJournalTypeDisplay — reversal suffix derived from state (PHASE 4)", () => {
  const openingEntry = (overrides: Partial<any> = {}) =>
    makeOperationalEntry({
      journal_type: "AccountOpeningBalance",
      journal_type_display: "رصيد افتتاحي",
      ...overrides,
    });

  it("the original is rendered plainly: رصيد افتتاحي", () => {
    expect(deriveJournalTypeDisplay(openingEntry())).toBe("رصيد افتتاحي");
  });

  it("the contra journal (reversal_of_entry_id set, still Posted) is rendered رصيد افتتاحي — معكوس", () => {
    const contra = openingEntry({ reversal_of_entry_id: "e3" });
    expect(deriveJournalTypeDisplay(contra)).toBe("رصيد افتتاحي — معكوس");
  });

  it("the Reversed original is rendered رصيد افتتاحي — معكوس too", () => {
    const reversed = openingEntry({ status: "Reversed" });
    expect(deriveJournalTypeDisplay(reversed)).toBe("رصيد افتتاحي — معكوس");
  });

  it("Draft and Cancelled entries never gain the reversal suffix", () => {
    expect(deriveJournalTypeDisplay(openingEntry({ status: "Draft" }))).toBe("رصيد افتتاحي");
    expect(deriveJournalTypeDisplay(openingEntry({ status: "Cancelled" }))).toBe("رصيد افتتاحي");
  });

  it("a General Journal contra also derives the suffix on its base label", () => {
    const contra = makeOperationalEntry({ reversal_of_entry_id: "e3" });
    expect(deriveJournalTypeDisplay(contra)).toBe("اليومية العامة — معكوس");
  });
});

describe("reversalEntryNumber — counterpart resolution over ReversalContext (PHASE 4)", () => {
  const ctx = {
    entryNumberById: new Map([
      ["e3", "3"],
      ["e8", "8"],
    ]),
    reversedById: new Map([["e3", "8"]]),
  };

  it("resolves the ORIGINAL's number on a contra journal", () => {
    const contra = makeOperationalEntry({ id: "e8", entry_number: "8", reversal_of_entry_id: "e3" });
    expect(reversalEntryNumber(contra, ctx)).toBe("3");
  });

  it("resolves the CONTRA's number on a Reversed original", () => {
    const reversed = makeOperationalEntry({ id: "e3", entry_number: "3", status: "Reversed" });
    expect(reversalEntryNumber(reversed, ctx)).toBe("8");
  });

  it("returns undefined without a context (or for plain entries)", () => {
    expect(reversalEntryNumber(makeOperationalEntry({ reversal_of_entry_id: "e3" }))).toBeUndefined();
    expect(reversalEntryNumber(makeOperationalEntry(), ctx)).toBeUndefined();
  });

  it("toJournalLines (two-line) carries the counterpart number on every leg", () => {
    const contra = makeOperationalEntry({ id: "e8", entry_number: "8", reversal_of_entry_id: "e3" });
    const lines = toJournalLines(contra, ctx);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.reversal_entry_number === "3")).toBe(true);
    expect(lines.every((l) => l.is_contra)).toBe(true);
  });

  it("toJournalLinesSingleLine (one-line) carries the counterpart number too", () => {
    const reversed = makeOperationalEntry({ id: "e3", entry_number: "3", status: "Reversed" });
    const rows = toJournalLinesSingleLine(reversed, ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0].reversal_entry_number).toBe("8");
  });

  it("the suffix label and the counterpart number are derived together on both shapes", () => {
    const contra = makeOperationalEntry({
      id: "e8",
      entry_number: "8",
      reversal_of_entry_id: "e3",
      journal_type: "AccountOpeningBalance",
      journal_type_display: "رصيد افتتاحي",
    });
    const [line] = toJournalLines(contra, ctx);
    expect(line.journal_type_display).toBe("رصيد افتتاحي — معكوس");
    expect(line.reversal_entry_number).toBe("3");

    const [single] = toJournalLinesSingleLine(contra, ctx);
    expect(single.journal_type_display).toBe("رصيد افتتاحي — معكوس");
    expect(single.reversal_entry_number).toBe("3");
  });
});

describe("temporary reversed preparation journals are never active transactions (PHASE 4)", () => {
  it("a preparation entry auto-reversed with its Posted contra both stay in audit, the pair stays adjacent", () => {
    // A temporary preparation journal (e.g. a legacy standalone opening that
    // got auto-reversed when the aggregate migration was posted): the original
    // is now status=Reversed, its adjusted contra is Posted with the link.
    const prep = makeOperationalEntry({ id: "prep", entry_number: "7", status: "Reversed" });
    const contra = makeOperationalEntry({ id: "c1", entry_number: "12", reversal_of_entry_id: "prep" });
    const official = makeOperationalEntry({ id: "e1", entry_number: "2" });

    const { operational, audit } = partitionJournalEntries([prep, contra, official]);

    expect(operational.map((e) => e.id)).toEqual(["e1"]);
    expect(audit.map((e) => e.id)).toEqual(["prep", "c1"]);
    // One audit story: contra groups under its original.
    expect(auditGroupKey(contra)).toBe(auditGroupKey(prep));
    expect(auditGroupKey(prep)).toBe("prep");
  });

  it("every derived row captures the reversal relationship as state, never as an entry type", () => {
    const prep = makeOperationalEntry({ id: "prep", entry_number: "7", status: "Reversed" });
    const contra = makeOperationalEntry({ id: "c1", entry_number: "12", reversal_of_entry_id: "prep" });
    const official = makeOperationalEntry({ id: "e1", entry_number: "2" });
    const ctx = {
      entryNumberById: new Map([
        ["prep", "7"],
        ["c1", "12"],
      ]),
      reversedById: new Map([["prep", "12"]]),
    };

    const registerLines = [official, prep, contra].flatMap((e) => toJournalLines(e, ctx));
    // Only the official entry contributes to the operational register surface;
    // both parties carry the reversal state on their own (audit-only) rows.
    expect(registerLines.filter((l) => l.status === "Reversed")).toHaveLength(2);
    expect(registerLines.filter((l) => l.is_contra)).toHaveLength(2);
    expect(registerLines.filter((l) => l.reversal_entry_number)).toHaveLength(4);
  });
});