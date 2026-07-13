/**
 * Centralized filter type definitions shared across the application.
 * All date-range and domain-specific filter types live here to avoid
 * duplication across service files and lib modules.
 */

/** Base date-range filter used by reports and journal queries. */
export type DateRangeFilters = {
  from_date: string;
  to_date: string;
};

/**
 * Filters for journal entry listing.
 * Previously defined inside journalEntryService.ts.
 */
export interface JournalFilters {
  from_date?: string;
  to_date?: string;
  journal_type?: string;
  account_id?: string;
  partner_id?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Standard report filters (date range).
 * All report-specific filter types (IncomeStatementFilters,
 * BalanceSheetFilters, etc.) are aliases of this type.
 */
export type ReportFilters = DateRangeFilters;
