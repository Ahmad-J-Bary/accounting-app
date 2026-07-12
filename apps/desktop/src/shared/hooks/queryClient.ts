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

  fixedAssets: ["fixed-assets"] as const,
  productionOrders: ["production-orders"] as const,
  auditLog: ["audit-log"] as const,
  users: ["users"] as const,
  roles: ["roles"] as const,
} as const;
