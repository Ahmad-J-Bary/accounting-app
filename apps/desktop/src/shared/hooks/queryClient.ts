import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

export const QUERY_KEYS = {
  partners: ["partners"] as const,
  partner: (id: string) => ["partners", id] as const,
  partnerLedger: (id: string) => ["partners", id, "ledger"] as const,
  partnerEquityStatement: (from?: string, to?: string) => ["partner-equity-statement", from, to] as const,

  customers: ["customers"] as const,
  customer: (id: string) => ["customers", id] as const,
  customerInvoices: (id: string) => ["customers", id, "invoices"] as const,
  customerPayments: (id: string) => ["customers", id, "payments"] as const,

  suppliers: ["suppliers"] as const,
  supplier: (id: string) => ["suppliers", id] as const,
  supplierInvoices: (id: string) => ["suppliers", id, "invoices"] as const,
  supplierPayments: (id: string) => ["suppliers", id, "payments"] as const,

  materials: ["materials"] as const,
  material: (id: string) => ["materials", id] as const,
  materialMovements: (id: string) => ["materials", id, "movements"] as const,
  materialExpenseLedger: (id: string) => ["materials", id, "ledger-movements"] as const,
  stockMovements: ["stock-movements"] as const,

  chartOfAccounts: ["chart-of-accounts"] as const,
  chartOfAccountsTree: ["chart-of-accounts-tree"] as const,
  accountLedger: (id: string) => ["account-ledger", id] as const,
  expenseItems: ["expense-items"] as const,

  categories: ["categories"] as const,
  materialsByCategory: ["materials-by-category"] as const,

  warehouses: ["warehouses"] as const,
  warehouseMaterials: (id: string) => ["warehouses", id, "materials"] as const,

  salesInvoices: ["sales-invoices"] as const,
  purchaseInvoices: ["purchase-invoices"] as const,
  invoice: (id: string) => ["invoices", id] as const,

  payments: ["payments"] as const,
  payment: (id: string) => ["payments", id] as const,

  settings: ["settings"] as const,
  currencyContext: ["currency-context"] as const,
  todayRates: ["today-rates"] as const,

  journalEntries: (filters?: { from_date?: string; to_date?: string }) =>
    ["journal-entries", filters] as const,

  receivablesPayables: ["receivables-payables"] as const,

  salesReturns: ["sales-returns"] as const,
  purchaseReturns: ["purchase-returns"] as const,

  incomeStatement: ["reports", "income-statement"] as const,
  balanceSheet: ["reports", "balance-sheet"] as const,
  trialBalance: (from?: string, to?: string) => ["reports", "trial-balance", from, to] as const,
  dashboard: ["reports", "dashboard"] as const,

  fixedAssets: ["fixed-assets"] as const,
  productionOrders: ["production-orders"] as const,
  auditLog: ["audit-log"] as const,
  users: ["users"] as const,
  roles: ["roles"] as const,

  damagedItems: ["damaged-items"] as const,
  stockAdjustments: ["stock-adjustments"] as const,
  openingBalanceMigrations: ["opening-balance-migrations"] as const,
  openingDraft: ["opening-wizard-draft"] as const,
  residualClassificationSpec: ["opening-balance", "residual-classification-spec"] as const,
  fiscalPeriods: ["fiscal-periods"] as const,
  distributableProfit: (start?: string, end?: string) => ["fiscal-periods", "distributable-profit", start, end] as const,
} as const;

/** All report/ledger query keys that should be invalidated after any accounting mutation. */
export const ALL_REPORT_KEYS: readonly (readonly unknown[])[] = [
  ["reports", "trial-balance"] as const,
  QUERY_KEYS.incomeStatement,
  QUERY_KEYS.balanceSheet,
  QUERY_KEYS.dashboard,
  ["journal-entries"] as const,
  QUERY_KEYS.chartOfAccounts,
  QUERY_KEYS.chartOfAccountsTree,
  QUERY_KEYS.salesReturns,
  QUERY_KEYS.purchaseReturns,
  QUERY_KEYS.receivablesPayables,
  ["account-ledger"] as const,
];

export const ALL_PARTY_KEYS: readonly (readonly unknown[])[] = [
  QUERY_KEYS.customers,
  QUERY_KEYS.suppliers,
  QUERY_KEYS.partners,
];

export const ALL_INVENTORY_KEYS: readonly (readonly unknown[])[] = [
  QUERY_KEYS.materials,
  QUERY_KEYS.stockMovements,
  QUERY_KEYS.damagedItems,
  QUERY_KEYS.stockAdjustments,
  QUERY_KEYS.fixedAssets,
  QUERY_KEYS.productionOrders,
];

export const ALL_INVOICE_KEYS: readonly (readonly unknown[])[] = [
  QUERY_KEYS.salesInvoices,
  QUERY_KEYS.purchaseInvoices,
  QUERY_KEYS.payments,
];

export const ALL_ACCOUNTING_MUTATION_KEYS: readonly (readonly unknown[])[] = [
  ...ALL_REPORT_KEYS,
  ...ALL_PARTY_KEYS,
  ...ALL_INVENTORY_KEYS,
  ...ALL_INVOICE_KEYS,
  QUERY_KEYS.openingBalanceMigrations,
  QUERY_KEYS.fiscalPeriods,
];

/** Keys every financial report/dashboard/ledger view depends on. More than one
 * domain below includes these because posting any journal entry can legally touch
 * any account classification. */
const REPORT_CORE_KEYS: readonly (readonly unknown[])[] = [
  ["journal-entries"] as const,
  ["account-ledger"] as const,
  ["account-ledger-lines"] as const,
  QUERY_KEYS.dashboard,
  QUERY_KEYS.incomeStatement,
  QUERY_KEYS.balanceSheet,
  ["reports", "trial-balance"] as const,
  QUERY_KEYS.receivablesPayables,
  QUERY_KEYS.salesReturns,
  QUERY_KEYS.purchaseReturns,
  QUERY_KEYS.chartOfAccounts,
  QUERY_KEYS.chartOfAccountsTree,
];

/** Keys affected by posting/deleting/reopening a SALES invoice. */
export const SALE_KEYS: readonly (readonly unknown[])[] = [
  ...REPORT_CORE_KEYS,
  QUERY_KEYS.salesInvoices,
  QUERY_KEYS.customers,
  QUERY_KEYS.partners,
  QUERY_KEYS.stockMovements,
  QUERY_KEYS.materials,
];

/** Keys affected by posting/deleting/reopening a PURCHASE invoice. */
export const PURCHASE_KEYS: readonly (readonly unknown[])[] = [
  ...REPORT_CORE_KEYS,
  QUERY_KEYS.purchaseInvoices,
  QUERY_KEYS.suppliers,
  QUERY_KEYS.partners,
  QUERY_KEYS.stockMovements,
  QUERY_KEYS.materials,
];

/** Keys affected by a customer payment (receipt), supplier payment, or its
 * create/update/delete. */
export const PAYMENT_RECEIPT_KEYS: readonly (readonly unknown[])[] = [
  ...REPORT_CORE_KEYS,
  QUERY_KEYS.payments,
  QUERY_KEYS.customers,
  QUERY_KEYS.suppliers,
  QUERY_KEYS.partners,
];

/** Keys affected by stock movements, adjustments, damaged goods, transfers,
 * production orders, and material master changes. */
export const INVENTORY_MUTATION_KEYS: readonly (readonly unknown[])[] = [
  ...REPORT_CORE_KEYS,
  QUERY_KEYS.stockMovements,
  QUERY_KEYS.materials,
  QUERY_KEYS.materialsByCategory,
  QUERY_KEYS.damagedItems,
  QUERY_KEYS.stockAdjustments,
  QUERY_KEYS.productionOrders,
  QUERY_KEYS.categories,
  QUERY_KEYS.warehouses,
];

/** Keys affected by a direct journal post/reversal (touches every classification). */
export const JOURNAL_MUTATION_KEYS: readonly (readonly unknown[])[] = [
  ...REPORT_CORE_KEYS,
  QUERY_KEYS.payments,
  QUERY_KEYS.salesInvoices,
  QUERY_KEYS.purchaseInvoices,
  QUERY_KEYS.customers,
  QUERY_KEYS.suppliers,
  QUERY_KEYS.partners,
  QUERY_KEYS.stockMovements,
  QUERY_KEYS.materials,
];

/** Keys affected by partner operations (capital, drawings, profit share, settle). */
export const PARTNER_MUTATION_KEYS: readonly (readonly unknown[])[] = [
  ...REPORT_CORE_KEYS,
  QUERY_KEYS.partners,
  QUERY_KEYS.partnerEquityStatement(),
  QUERY_KEYS.fixedAssets,
  QUERY_KEYS.receivablesPayables,
  QUERY_KEYS.payments,
];

/** Opening-balance lifecycle (create/post/lock) touches everything financial. */
export const OPENING_MUTATION_KEYS: readonly (readonly unknown[])[] = ALL_ACCOUNTING_MUTATION_KEYS;

/** Fiscal-period create/close/lock/reopen. */
export const FISCAL_MUTATION_KEYS: readonly (readonly unknown[])[] = [
  QUERY_KEYS.fiscalPeriods,
  QUERY_KEYS.distributableProfit(),
  ...REPORT_CORE_KEYS,
];

/** Profit distribution posts a journal entry — near-umbrella invalidation. */
export const PROFIT_DISTRIBUTION_KEYS: readonly (readonly unknown[])[] = [
  ...ALL_ACCOUNTING_MUTATION_KEYS,
  QUERY_KEYS.distributableProfit(),
  QUERY_KEYS.partnerEquityStatement(),
];

/** Settings changes (company, localization, warehouse setup, currencies, backup
 * location) refresh settings consumers and currency context. */
export const SETTINGS_MUTATION_KEYS: readonly (readonly unknown[])[] = [
  QUERY_KEYS.settings,
  QUERY_KEYS.currencyContext,
  QUERY_KEYS.todayRates,
];

/** Chart-of-accounts structure changes (create/update/delete/activate). */
export const CHART_MUTATION_KEYS: readonly (readonly unknown[])[] = [
  QUERY_KEYS.chartOfAccounts,
  QUERY_KEYS.chartOfAccountsTree,
];

/** Invalidate exactly the given keys against ACTIVE observers (the default
 * refetch type) so only views that are on screen refetch — minimal churn. */
export async function invalidateKeys(
  queryClient: QueryClient,
  keys: readonly (readonly unknown[])[],
) {
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

export async function invalidateAccountingMutationQueries(queryClient: QueryClient) {
  await invalidateKeys(queryClient, ALL_ACCOUNTING_MUTATION_KEYS);
}
