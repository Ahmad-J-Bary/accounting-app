import type { JournalEntryDto, JournalLineDto } from "@erp/shared-types";

/**
 * Explicit report policies (PHASE 3). Each report names the predicate it
 * consumes instead of sharing a generic filter, so a reversal pair can never
 * leak into one report and disappear from another silently:
 *
 *   - `isOfficialJournalEntry`  → GENERAL JOURNAL (official posted entries)
 *   - `isAuditEntry`            → AUDIT archive (everything non-operational)
 *   - `isPostedLedgerEntry`     → GENERAL LEDGER / TRIAL BALANCE / BALANCE SHEET
 *
 * The system NEVER deletes reversed records — reversals are a relationship
 * (`reversal_of_entry_id`) and the audit archive keeps both sides of every pair.
 */

export type JournalEntryRole =
  | "official_posted"
  | "reversed_original"
  | "reversal_contra"
  | "draft"
  | "cancelled"
  | "no_effect";

/** True when the journal moves at least one non-zero amount on some line. */
export function hasAccountingEffect(entry: JournalEntryDto): boolean {
  return entry.lines.some((line: JournalLineDto) => {
    const debit = parseFloat(line.debit_base ?? line.debit ?? "0");
    const credit = parseFloat(line.credit_base ?? line.credit ?? "0");
    return debit !== 0 || credit !== 0;
  });
}

/**
 * Single source of truth for the status/reversal role of an entry. Every
 * report policy is derived from this role — never from ad-hoc checks.
 */
export function entryRole(entry: JournalEntryDto): JournalEntryRole {
  if (entry.status === "Draft") return "draft";
  if (entry.status === "Cancelled") return "cancelled";
  if (entry.status === "Reversed") return "reversed_original";
  if (entry.reversal_of_entry_id) return "reversal_contra";
  if (!hasAccountingEffect(entry)) return "no_effect";
  return "official_posted";
}

/**
 * GENERAL JOURNAL — show official Posted accounting entries.
 *
 *   - Draft                          → NOT in the official journal
 *   - Cancelled                      → NOT in the official journal
 *   - Reversed temporary entry       → NOT shown as an active operational event
 *   - Final Posted Opening Migration → shown
 *   - Final Posted Residual Cls.     → shown IF it has an accounting effect
 */
export function isOfficialJournalEntry(entry: JournalEntryDto): boolean {
  return entryRole(entry) === "official_posted";
}

/**
 * AUDIT — show all non-operational entries according to the chosen audit
 * policy (the audit archive keeps the full history, never deletes):
 * Draft / Cancelled / Reversed originals / Posted contra reversals.
 */
export function isAuditEntry(entry: JournalEntryDto): boolean {
  return !isOfficialJournalEntry(entry);
}

/**
 * GENERAL LEDGER / TRIAL BALANCE / BALANCE SHEET — the posted-ledger policy.
 * Financial statements aggregate ONLY Posted entries with no reversal
 * relationship: neither side of a reversal pair may move a balance, and a
 * Draft / Cancelled / Reversed original is never part of the GL.
 */
export function isPostedLedgerEntry(entry: JournalEntryDto): boolean {
  return (
    entry.status === "Posted" &&
    !entry.reversal_of_entry_id
  );
}