import type { JournalEntryDto, JournalLineDto } from "@erp/shared-types";
import { isPostedLedgerEntry } from "@modules/reports/lib/report-policies";

/**
 * GL-driven dashboard KPIs. Every tile is computed from the posted-ledger
 * feed (`isPostedLedgerEntry`: Posted with no reversal relationship — the same
 * policy the backend ledger surfaces for GL / Trial Balance / Balance Sheet).
 *
 * Account nature (normal balance) comes from the enriched `account_type`
 * (Assets/Liabilities/Equity/Revenue/Expenses) with an `account_purpose`
 * fallback, so the tiles keep working even when a line was fetched through a
 * path that did not enrich the account type.
 *
 * Tile semantics:
 *   - `sales`        — credit-normal Revenue flows (net credit).
 *   - `purchases`    — debit-normal Expenses flows, reported as a positive magnitude.
 *   - `cashBalance`  — Bank + General purposes, signed (positive = net liquid position).
 *   - `receivables`  — net Receivable position, reported as a magnitude.
 *   - `payables`     — net Payable position, reported as a magnitude.
 *   - `inventory`    — net Inventory position, signed (positive = asset on hand).
 */

export interface DashboardKpis {
  sales: number;
  purchases: number;
  cashBalance: number;
  receivables: number;
  payables: number;
  inventory: number;
}

/** One month of the income series, keyed by `YYYY-MM` (display labels are a
 * presentation concern and stay on the caller side). */
export interface GlMonthlyIncome {
  yearMonth: string;
  revenue: number;
  expenses: number;
}

const CREDIT_NORMAL_TYPES = new Set(["Liabilities", "Equity", "Revenue"]);

/** 1 for credit-normal accounts, −1 for debit-normal (Assets / Expenses). */
function normalSign(accountType?: string): 1 | -1 {
  return accountType && CREDIT_NORMAL_TYPES.has(accountType) ? 1 : -1;
}

/** Purpose → account-type fallback for the (rare) un-enriched line. */
function purposeTypeFallback(accountPurpose?: string): string | undefined {
  if (!accountPurpose) return undefined;
  if (accountPurpose === "receivable" || accountPurpose === "inventory" || accountPurpose === "bank") {
    return "Assets";
  }
  if (accountPurpose === "payable" || accountPurpose === "loan") {
    return "Liabilities";
  }
  if (
    accountPurpose === "partner_capital" ||
    accountPurpose === "partner_drawings" ||
    accountPurpose === "partner_current" ||
    accountPurpose === "retained_earnings" ||
    accountPurpose === "opening_balance_equity" ||
    accountPurpose === "opening_equity_adjustment" ||
    accountPurpose === "prior_period_adjustment" ||
    accountPurpose === "other_equity"
  ) {
    return "Equity";
  }
  return undefined;
}

function lineType(line: JournalLineDto): string | undefined {
  return line.account_type || purposeTypeFallback(line.account_purpose);
}

/** Signed net movement of one ledger line in base currency. */
function lineNet(line: JournalLineDto): number {
  const debit = parseFloat(line.debit_base ?? line.debit ?? "0");
  const credit = parseFloat(line.credit_base ?? line.credit ?? "0");
  const sign = normalSign(lineType(line));
  return sign === 1 ? credit - debit : debit - credit;
}

export function computeDashboardKpis(entries: JournalEntryDto[]): DashboardKpis & { monthly: GlMonthlyIncome[] } {
  let sales = 0;
  let purchases = 0;
  let cashBalance = 0;
  let receivable = 0;
  let payable = 0;
  let inventory = 0;
  const byMonth = new Map<string, { revenue: number; expenses: number }>();

  for (const entry of entries) {
    if (!isPostedLedgerEntry(entry)) continue;

    const monthKey = entry.entry_date ? entry.entry_date.slice(0, 7) : undefined;

    for (const line of entry.lines) {
      const net = lineNet(line);
      const accountType = lineType(line);
      const purpose = line.account_purpose;

      // Income-statement flows — grouped by account type.
      if (accountType === "Revenue") {
        sales += net;
        if (monthKey) {
          const bucket = byMonth.get(monthKey) || { revenue: 0, expenses: 0 };
          bucket.revenue += net;
          byMonth.set(monthKey, bucket);
        }
      } else if (accountType === "Expenses") {
        purchases += net;
        if (monthKey) {
          const bucket = byMonth.get(monthKey) || { revenue: 0, expenses: 0 };
          bucket.expenses += net;
          byMonth.set(monthKey, bucket);
        }
      }

      // Balance-sheet positions — grouped by account purpose so Cash/AR/AP/
      // Inventory stay meaningful even when the chart mixes general accounts.
      if (purpose === "bank" || purpose === "general") {
        cashBalance += net;
      } else if (purpose === "receivable") {
        receivable += net;
      } else if (purpose === "payable") {
        payable += net;
      } else if (purpose === "inventory") {
        inventory += net;
      }
    }
  }

  const monthly = Array.from(byMonth.entries())
    .map(([yearMonth, { revenue, expenses }]) => ({
      yearMonth,
      revenue,
      expenses: Math.abs(expenses),
    }))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

  return {
    sales,
    purchases: Math.abs(purchases),
    cashBalance,
    receivables: Math.abs(receivable),
    payables: Math.abs(payable),
    inventory,
    monthly,
  };
}