import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
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
} as const;

/** All report query keys that should be invalidated after any accounting mutation. */
export const ALL_REPORT_KEYS: readonly (readonly unknown[])[] = [
  QUERY_KEYS.trialBalance(),
  QUERY_KEYS.incomeStatement,
  QUERY_KEYS.balanceSheet,
  QUERY_KEYS.partnerProfitShare,
  QUERY_KEYS.journalEntries({}),
  QUERY_KEYS.chartOfAccounts,
  QUERY_KEYS.receivablesPayables,
];

export const ALL_PARTY_KEYS: readonly (readonly unknown[])[] = [
  QUERY_KEYS.customers,
  QUERY_KEYS.suppliers,
  QUERY_KEYS.partners,
];

export const ALL_INVENTORY_KEYS: readonly (readonly unknown[])[] = [
  QUERY_KEYS.materials,
  QUERY_KEYS.stockMovements,
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
];

export async function invalidateAccountingMutationQueries(queryClient: QueryClient) {
  await Promise.all(
    ALL_ACCOUNTING_MUTATION_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: "all" }),
    ),
  );
}
