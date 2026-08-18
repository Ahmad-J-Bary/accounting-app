import { startOfDay, endOfDay, isWithinRange } from "@modules/reports/lib/date-utils";
import { computeGlAccountNets } from "@modules/reports/lib/glAccountNets";
import { computeInventoryProjection } from "@modules/reports/lib/inventory";
import type { ReportFilters } from "@shared/types/filters";
import type {
  AccountDto,
  InvoiceDto,
  JournalEntryDto,
  MaterialDto,
  PurchaseReturnDto,
  SalesReturnDto,
  StockMovementDetailDto,
} from "@erp/shared-types";

/** Alias kept for backward compatibility with hooks that import from this module. */
export type IncomeStatementFilters = ReportFilters;

export type LoadedIncomeStatementData = {
  salesInvoices: InvoiceDto[];
  purchaseInvoices: InvoiceDto[];
  purchaseReturns: PurchaseReturnDto[];
  salesReturns: SalesReturnDto[];
  expenseAccounts?: AccountDto[];
  stockMovementsByMaterial: Map<string, StockMovementDetailDto[]>;
  materials: MaterialDto[];
  accounts?: AccountDto[];
  entries?: JournalEntryDto[];
};

export type IncomeStatementRow = {
  label: string;
  value: number;
};

export type IncomeStatementSection = {
  id: "revenues" | "liabilities" | "trading" | "profit-loss";
  title: string;
  totalLabel: string;
  totalValue: number;
  rows: IncomeStatementRow[];
};

export type IncomeStatementComputed = {
  salesTotal: number;
  purchaseTotal: number;
  purchaseReturnsTotal: number;
  salesReturnsTotal: number;
  discountsEarned: number;
  discountsGranted: number;
  openingInventory: number;
  closingInventory: number;
  totalExpenses: number;
  totalRevenue: number;
  totalLiabilities: number;
  grossProfit: number;
  netProfit: number;
  salesCount: number;
  purchaseCount: number;
  expenseAccountsCount: number;
  expenseRows: IncomeStatementRow[];
  sections: IncomeStatementSection[];
};

export type IncomeStatementStyle = "cards";

export const emptyIncomeStatementData: LoadedIncomeStatementData = {
  salesInvoices: [],
  purchaseInvoices: [],
  purchaseReturns: [],
  salesReturns: [],
  stockMovementsByMaterial: new Map(),
  materials: [],
  accounts: [],
  entries: [],
};

/**
 * Operational expense-account codes excluded from "إجمالي المصاريف": their
 * economics flow through dedicated lines of the statement instead — purchases
 * (41) and sales returns (42) stay in the trading section, drawings (44) are a
 * contra-equity item, inventory settlement losses (45) and discounts granted
 * (47) adjust inventory / revenue, and depreciation (46) is reported on its
 * own line. Expense accounts are otherwise identified SEMANTICALLY by
 * `account_type === "Expenses"`, never by name matching.
 */
const OPERATIONAL_EXPENSE_EXCLUDED_CODES = new Set(["41", "42", "44", "45", "46", "47"]);

const SYSTEM_DEPRECIATION_ID = "00000000-0000-0000-0000-000000000046";

export function computeIncomeStatement(
  filters: IncomeStatementFilters,
  data: LoadedIncomeStatementData,
): IncomeStatementComputed {
  const fromTs = startOfDay(filters.from_date);
  const toTs = endOfDay(filters.to_date);

  const accounts = data.accounts ?? [];
  const entries = data.entries ?? [];
  const nets = computeGlAccountNets(entries, { fromTs, toTs, accounts });

  // --- Authoritative posted-ledger flows (same projection the Dashboard
  // consumes in `glAccountNets`). Sales ≠ Receivables and Purchases ≠
  // Payables: each line is taken from its own account, only for the period. ---
  const salesTotal = nets.netByCodes(["311", "312"]);
  const purchaseTotal = nets.netByCodes(["41"]);
  const purchaseReturnsTotal = nets.netByCodes(["32"]);
  const salesReturnsTotal = nets.netByCodes(["42"]);
  const discountsEarned = nets.netByCodes(["332"]);
  const discountsGranted = nets.netByCodes(["47"]);

  // Inventory settlement adjustments that flow into closing inventory.
  const adjustmentGains = nets.netByCodes(["331"]);
  const adjustmentLosses = nets.netByCodes(["45"]);

  const depAccounts = accounts.filter(
    (account) => account.id === SYSTEM_DEPRECIATION_ID || account.code === "46",
  );
  const depreciationExpense = nets.netForAccounts(depAccounts.map((account) => account.id));

  // --- بضاعة أول المدة / بضاعة آخر المدة — the SHARED stock-movement
  // projection (also used by Dashboard). Opening + period in/out (periodic,
  // excluding Adjustment/Damaged/Transfer) + 331−45 settlement net. ---
  const movements = Array.from(data.stockMovementsByMaterial.values()).flat();
  const { openingInventory, closingInventory } = computeInventoryProjection(
    movements,
    { fromTs, toTs },
    { gains: adjustmentGains, losses: adjustmentLosses },
  );

  // --- Operating expenses, classified semantically (Expenses type, minus the
  // operational accounts above) with normal-balance sign — no name matching,
  // no hardcoded parent-UUID, no blind Math.abs. ---
  const expenseRows = accounts
    .filter(
      (account) =>
        account.account_type === "Expenses" && !OPERATIONAL_EXPENSE_EXCLUDED_CODES.has(account.code),
    )
    .map((account) => ({ label: account.name_ar, value: nets.accountNets.get(account.id)?.net ?? 0 }))
    .filter((row) => row.value !== 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  // إجمالي المصاريف = مصاريف التشغيل + مصروف الإهلاك السنوي
  const totalExpenses = expenseRows.reduce((sum, row) => sum + row.value, 0) + depreciationExpense;

  // --- Trading totals (periodic): Revenue side vs Liabilities side. ---
  const totalRevenue = salesTotal + closingInventory + purchaseReturnsTotal + discountsEarned;
  const totalLiabilities = openingInventory + purchaseTotal + salesReturnsTotal + discountsGranted;
  const grossProfit = totalRevenue - totalLiabilities;

  // صافي الأرباح (أثر التسويات ضمن مجمل الربح عبر بضاعة آخر المدة)
  const netProfit = grossProfit - totalExpenses;

  // Invoice counts remain available for display labels (المبيعات N فاتورة مرحلة).
  const postedSales = data.salesInvoices.filter(
    (invoice) => invoice.status === "Posted" && isWithinRange(invoice.issued_at, fromTs, toTs),
  );
  const postedPurchases = data.purchaseInvoices.filter(
    (invoice) => invoice.status === "Posted" && isWithinRange(invoice.issued_at, fromTs, toTs),
  );

  const sections: IncomeStatementSection[] = [
    {
      id: "revenues",
      title: "الإيرادات",
      totalLabel: "إجمالي الإيرادات",
      totalValue: totalRevenue,
      rows: [
        { label: `المبيعات (${postedSales.length} فاتورة مرحلة)`, value: salesTotal },
        { label: "بضاعة آخر المدة", value: closingInventory },
        { label: "مرتجعات المشتريات", value: purchaseReturnsTotal },
        { label: "خصوم مكتسبة", value: discountsEarned },
      ],
    },
    {
      id: "liabilities",
      title: "الخصوم",
      totalLabel: "إجمالي الخصوم",
      totalValue: totalLiabilities,
      rows: [
        { label: "بضاعة أول المدة", value: openingInventory },
        { label: `المشتريات (${postedPurchases.length} فاتورة مرحلة)`, value: purchaseTotal },
        { label: "مرتجعات المبيعات", value: salesReturnsTotal },
        { label: "خصوم ممنوحة", value: discountsGranted },
      ],
    },
    {
      id: "trading",
      title: "حساب المتاجرة",
      totalLabel: "إجمالي الأرباح",
      totalValue: grossProfit,
      rows: [
        { label: "إجمالي الإيرادات", value: totalRevenue },
        { label: "إجمالي الخصوم", value: totalLiabilities },
      ],
    },
    {
      id: "profit-loss",
      title: "حساب الأرباح والخسائر",
      totalLabel: "صافي الأرباح",
      totalValue: netProfit,
      rows: [
        { label: "إجمالي الأرباح", value: grossProfit },
        { label: "إجمالي المصاريف", value: totalExpenses },
      ],
    },
  ];

  return {
    salesTotal,
    purchaseTotal,
    purchaseReturnsTotal,
    salesReturnsTotal,
    discountsEarned,
    discountsGranted,
    openingInventory,
    closingInventory,
    totalExpenses,
    totalRevenue,
    totalLiabilities,
    grossProfit,
    netProfit,
    salesCount: postedSales.length,
    purchaseCount: postedPurchases.length,
    expenseAccountsCount: expenseRows.length,
    expenseRows,
    sections,
  };
}