import type { JournalEntryDto } from "@erp/shared-types";
import {
  computeGlAccountNets,
  type GlAccountNets,
} from "@modules/reports/lib/glAccountNets";

/**
 * GL-driven dashboard KPIs. Every tile is computed from the posted-ledger
 * feed through `computeGlAccountNets` — the SAME projection the Income
 * Statement consumes, so a Dr/Cr never moves one report and disappears from
 * another (see `reports/lib/glAccountNets`).
 *
 * Tile semantics:
 *   - `sales`       — credit-normal Revenue flows (net credit).
 *   - `purchases`   — debit-normal Expenses flows, reported as a positive magnitude.
 *   - `cash`        — General-purpose (treasury) accounts, signed.
 *   - `bank`        — Bank-purpose accounts, signed.
 *   - `receivables` — net Receivable position, reported as a magnitude.
 *   - `payables`    — net Payable position, reported as a magnitude.
 *   - `loans`       — net Loan position, reported as a magnitude.
 *
 * `inventory` is intentionally NOT here: in this (periodic) inventory model the
 * GL inventory accounts are only touched by adjustments/damage, not by regular
 * sales/purchases posting — the authoritative valuation lives in the shared
 * stock-movement projection (`reports/lib/inventory`) used by both the Dashboard
 * and "بضاعة آخر المدة".
 */

export interface DashboardKpis {
  sales: number;
  purchases: number;
  cash: number;
  bank: number;
  receivables: number;
  payables: number;
  loans: number;
}

/** One month of the income series, keyed by `YYYY-MM` (display labels are a
 * presentation concern and stay on the caller side). */
export interface GlMonthlyIncome {
  yearMonth: string;
  revenue: number;
  expenses: number;
}

export function computeDashboardKpis(entries: JournalEntryDto[]): DashboardKpis & { monthly: GlMonthlyIncome[] } {
  const nets: GlAccountNets = computeGlAccountNets(entries);

  const sales = nets.typeNets.Revenue;
  const purchases = Math.abs(nets.typeNets.Expenses);

  let cash = 0;
  let bank = 0;
  let receivable = 0;
  let payable = 0;
  let loan = 0;
  const byMonth = new Map<string, { revenue: number; expenses: number }>();

  for (const line of nets.lines) {
    const monthKey = line.entryDate ? line.entryDate.slice(0, 7) : undefined;
    const accountType = line.accountType;

    if (monthKey) {
      const bucket = byMonth.get(monthKey) || { revenue: 0, expenses: 0 };
      if (accountType === "Revenue") {
        bucket.revenue += line.net;
      } else if (accountType === "Expenses") {
        bucket.expenses += line.net;
      }
      byMonth.set(monthKey, bucket);
    }

    const purpose = line.accountPurpose;
    if (purpose === "general") {
      cash += line.net;
    } else if (purpose === "bank") {
      bank += line.net;
    } else if (purpose === "receivable") {
      receivable += line.net;
    } else if (purpose === "payable") {
      payable += line.net;
    } else if (purpose === "loan") {
      loan += line.net;
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
    purchases,
    cash,
    bank,
    receivables: Math.abs(receivable),
    payables: Math.abs(payable),
    loans: Math.abs(loan),
    monthly,
  };
}