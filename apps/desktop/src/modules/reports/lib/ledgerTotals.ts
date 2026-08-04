import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import { SYSTEM_ACCOUNT_IDS } from "@erp/shared-types";
import { toLocalDateStr } from "@shared/lib/format";
import type { AccountDto, JournalEntryDto } from "@erp/shared-types";

export interface AccountLedgerTotal {
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  debit: number;
  credit: number;
  endingBalance: number;
}

export interface LedgerTotalsResult {
  ledgerTotals: Map<string, AccountLedgerTotal>;
  totalDrawings: number;
}

function isCreditNatureAccount(account: AccountDto): boolean {
  return ["Liabilities", "Equity", "Revenue"].includes(account.account_type);
}

/**
 * Computes general ledger totals for all accounts with strict date range partitioning:
 * 1. Opening entries (source_type = OPENING_BALANCE or opening journal types) and entries before fromDate -> Pre-Period Opening Balance.
 * 2. Operational entries between fromDate and toDate -> Period Movements (Period Debit & Credit).
 * 3. Entries strictly after toDate -> Excluded completely.
 * 4. Correctly handles Credit nature accounts (Equity, Liabilities) vs Debit nature accounts (Assets, Expenses).
 */
export function computeLedgerTotals(
  accounts: AccountDto[],
  entries: JournalEntryDto[],
  fromDate?: string,
  toDate?: string,
): LedgerTotalsResult {
  let totalDrawings = 0;
  const ledgerTotals = new Map<string, AccountLedgerTotal>();

  const fromDateStr = fromDate ? fromDate.split("T")[0] : undefined;
  const toDateStr = toDate ? toDate.split("T")[0] : undefined;

  // 1. Identify accounts that have explicit INDIVIDUAL opening balance journal entries in DB
  //    (i.e., NOT via consolidated_capital — those are handled separately below)
  const accountsWithOpeningEntries = new Set<string>();

  for (const entry of entries) {
    const isConsolidatedCapital = entry.source_id === "consolidated_capital";
    const desc = entry.description || "";
    const isOpeningEntry =
      isConsolidatedCapital ||
      entry.source_type === "OPENING_BALANCE" ||
      entry.journal_type === "CashOpeningBalance" ||
      entry.journal_type === "AccountOpeningBalance" ||
      entry.journal_type === "MaterialOpeningBalance" ||
      desc.includes("رصيد افتتاحي") ||
      desc.includes("أول المدة");

    if (isOpeningEntry) {
      for (const line of entry.lines) {
        // Mark ALL accounts in any opening entry (including consolidated_capital)
        // so their static opening_balance is not double-applied on top of the journal
        accountsWithOpeningEntries.add(line.account_id);
      }
    }
  }

  // 2. Compute initial static opening net balance map per account (from account.opening_balance)
  // For accounts without explicit opening journal entries to avoid double counting.
  const initialOpeningNetMap = new Map<string, number>();

  for (const account of accounts) {
    const staticOpening = parseSafeNumber(account.opening_balance);
    if (staticOpening !== 0 && !accountsWithOpeningEntries.has(account.id)) {
      // For credit nature accounts (Equity, Liabilities), positive static opening means Credit (- net)
      // For debit nature accounts (Assets), positive static opening means Debit (+ net)
      const net = isCreditNatureAccount(account) ? -staticOpening : staticOpening;
      initialOpeningNetMap.set(account.id, net);
    }
  }

  // 3. Partition journal entries into pre-period (opening) and period entries
  const prePeriodNetMap = new Map<string, { debit: number; credit: number }>();
  const periodNetMap = new Map<string, { debit: number; credit: number }>();

  for (const entry of entries) {
    const entryDate = toLocalDateStr(entry.entry_date);

    // Exclude entries strictly after toDate
    if (toDateStr && entryDate > toDateStr) {
      continue;
    }

    const desc = entry.description || "";
    const isOpeningEntry =
      entry.source_type === "OPENING_BALANCE" ||
      entry.source_id === "consolidated_capital" ||
      entry.journal_type === "CashOpeningBalance" ||
      entry.journal_type === "AccountOpeningBalance" ||
      entry.journal_type === "MaterialOpeningBalance" ||
      desc.includes("رصيد افتتاحي") ||
      desc.includes("أول المدة");

    const isPrePeriod = isOpeningEntry || (fromDateStr != null && entryDate < fromDateStr);

    const targetMap = isPrePeriod ? prePeriodNetMap : periodNetMap;

    for (const line of entry.lines) {
      const debitVal = parseFloat(line.debit_base || line.debit || "0");
      const creditVal = parseFloat(line.credit_base || line.credit || "0");

      if (line.account_id === SYSTEM_ACCOUNT_IDS.DRAWINGS) {
        totalDrawings += Math.abs(debitVal - creditVal);
      }

      const cur = targetMap.get(line.account_id) || { debit: 0, credit: 0 };
      cur.debit += debitVal;
      cur.credit += creditVal;
      targetMap.set(line.account_id, cur);
    }
  }

  // 4. Build AccountLedgerTotal for each account
  for (const account of accounts) {
    const initialStaticNet = initialOpeningNetMap.get(account.id) ?? 0;
    const prePeriod = prePeriodNetMap.get(account.id) || { debit: 0, credit: 0 };
    const period = periodNetMap.get(account.id) || { debit: 0, credit: 0 };

    const preNet = prePeriod.debit - prePeriod.credit;
    const totalOpeningNet = initialStaticNet + preNet;

    let openingDebit = 0;
    let openingCredit = 0;

    if (totalOpeningNet > 0) {
      openingDebit = totalOpeningNet;
    } else if (totalOpeningNet < 0) {
      openingCredit = Math.abs(totalOpeningNet);
    }

    const periodDebit = period.debit;
    const periodCredit = period.credit;

    const endingNet = (openingDebit - openingCredit) + periodDebit - periodCredit;

    ledgerTotals.set(account.id, {
      openingDebit,
      openingCredit,
      periodDebit,
      periodCredit,
      debit: openingDebit + periodDebit,
      credit: openingCredit + periodCredit,
      endingBalance: endingNet,
    });
  }

  // 5. Build the final result
  return { ledgerTotals, totalDrawings };
}

