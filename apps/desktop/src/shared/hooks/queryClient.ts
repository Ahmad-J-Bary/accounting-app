import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export const QUERY_KEYS = {
  partners: ["partners"] as const,
  partner: (id: string) => ["partners", id] as const,
  partnerLedger: (id: string) => ["partners", id, "ledger"] as const,

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
  partnerProfitShare: ["reports", "partner-profit-share"] as const,
  trialBalance: (filters?: { from_date?: string; to_date?: string }) =>
    ["reports", "trial-balance", filters] as const,

  fixedAssets: ["fixed-assets"] as const,
  productionOrders: ["production-orders"] as const,
  auditLog: ["audit-log"] as const,
  users: ["users"] as const,
  roles: ["roles"] as const,

  damagedItems: ["damaged-items"] as const,
  stockAdjustments: ["stock-adjustments"] as const,
  openingBalanceMigrations: ["opening-balance-migrations"] as const,
  openingDraft: ["opening-wizard-draft"] as const,
  fiscalPeriods: ["fiscal-periods"] as const,
  distributableProfit: (start?: string, end?: string) => ["fiscal-periods", "distributable-profit", start, end] as const,
} as const;

/** All report/ledger query keys that should be invalidated after any accounting mutation. */
export const ALL_REPORT_KEYS: readonly (readonly unknown[])[] = [
  ["reports", "trial-balance"] as const,
  QUERY_KEYS.incomeStatement,
  QUERY_KEYS.balanceSheet,
  QUERY_KEYS.partnerProfitShare,
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

export async function invalidateAccountingMutationQueries(queryClient: QueryClient) {
  await Promise.all(
    ALL_ACCOUNTING_MUTATION_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: "all" }),
    ),
  );
}
