import type {
  AccountDto,
  AccountLedgerDto,
  InvoiceDto,
  MaterialDto,
  PurchaseReturnDto,
  SalesReturnDto,
  StockMovementDetailDto,
} from "@erp/shared-types";

export type IncomeStatementFilters = {
  from_date: string;
  to_date: string;
};

export type LoadedIncomeStatementData = {
  salesInvoices: InvoiceDto[];
  purchaseInvoices: InvoiceDto[];
  purchaseReturns: PurchaseReturnDto[];
  salesReturns: SalesReturnDto[];
  expenseAccounts: AccountDto[];
  expenseLedgers: Map<string, AccountLedgerDto>;
  stockMovementsByMaterial: Map<string, StockMovementDetailDto[]>;
  materials: MaterialDto[];
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
  sections: IncomeStatementSection[];
};

export type IncomeStatementStyle = "cards";

export const emptyIncomeStatementData: LoadedIncomeStatementData = {
  salesInvoices: [],
  purchaseInvoices: [],
  purchaseReturns: [],
  salesReturns: [],
  expenseAccounts: [],
  expenseLedgers: new Map(),
  stockMovementsByMaterial: new Map(),
  materials: [],
};

export function parseNumber(value?: string | number | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfDay(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).getTime();
}

function endOfDay(dateValue: string) {
  return new Date(`${dateValue}T23:59:59.999`).getTime();
}

function isWithinRange(isoDate: string, fromTs: number, toTs: number) {
  const timestamp = new Date(isoDate).getTime();
  return Number.isFinite(timestamp) && timestamp >= fromTs && timestamp <= toTs;
}

function getInvoiceBaseTotal(invoice: InvoiceDto) {
  const v2Total = parseNumber(invoice.total_amount_v2?.base_amount);
  if (v2Total > 0) return v2Total;
  const total = parseNumber(invoice.total_amount);
  const rate = parseNumber(invoice.exchange_rate) || 1;
  return total / rate;
}

function getReturnBaseTotal(document: PurchaseReturnDto | SalesReturnDto) {
  const directTotal = parseNumber(document.total_amount);
  if (directTotal > 0) return directTotal;
  return (document.lines ?? []).reduce((sum, line) => sum + parseNumber(line.line_total), 0);
}

function getSignedMovementValue(movement: StockMovementDetailDto) {
  if (movement.movement_type === "Transfer") return 0;
  const base = parseNumber(movement.total_cost_base);
  const orig = parseNumber(movement.total_cost);
  const value = base !== 0 ? base : orig;
  return movement.is_inflow ? value : -value;
}

export function computeIncomeStatement(
  filters: IncomeStatementFilters,
  data: LoadedIncomeStatementData,
): IncomeStatementComputed {
  const fromTs = startOfDay(filters.from_date);
  const toTs = endOfDay(filters.to_date);

  const postedSales = data.salesInvoices.filter(
    (invoice) => invoice.status === "Posted" && isWithinRange(invoice.issued_at, fromTs, toTs),
  );
  const postedPurchases = data.purchaseInvoices.filter(
    (invoice) => invoice.status === "Posted" && isWithinRange(invoice.issued_at, fromTs, toTs),
  );

  const salesTotal = postedSales.reduce((sum, invoice) => sum + getInvoiceBaseTotal(invoice), 0);
  const purchaseTotal = postedPurchases.reduce((sum, invoice) => sum + getInvoiceBaseTotal(invoice), 0);
  const purchaseReturnsTotal = data.purchaseReturns
    .filter((document) => isWithinRange(document.return_date, fromTs, toTs))
    .reduce((sum, document) => sum + getReturnBaseTotal(document), 0);
  const salesReturnsTotal = data.salesReturns
    .filter((document) => isWithinRange(document.return_date, fromTs, toTs))
    .reduce((sum, document) => sum + getReturnBaseTotal(document), 0);

  // OpeningBalance movements always count toward opening inventory (regardless of date)
  const openingInventory = Array.from(data.stockMovementsByMaterial.values()).reduce((sum, movements) => {
    return sum + movements.reduce((materialSum, movement) => {
      const movementTs = new Date(movement.movement_date).getTime();
      if (!Number.isFinite(movementTs) || movementTs > toTs) return materialSum;
      if (movement.movement_type === "OpeningBalance") {
        return materialSum + getSignedMovementValue(movement);
      }
      if (movementTs >= fromTs) return materialSum;
      return materialSum + getSignedMovementValue(movement);
    }, 0);
  }, 0);

  const periodMovements = Array.from(data.stockMovementsByMaterial.values()).reduce((sum, movements) => {
    const movementTotal = movements.reduce((materialSum, movement) => {
      const movementTs = new Date(movement.movement_date).getTime();
      if (!Number.isFinite(movementTs) || movementTs < fromTs || movementTs > toTs) {
        return materialSum;
      }
      if (movement.movement_type === "OpeningBalance") return materialSum;
      return materialSum + getSignedMovementValue(movement);
    }, 0);
    return sum + movementTotal;
  }, 0);

  const closingInventory = openingInventory + periodMovements;

  const totalExpenses = data.expenseAccounts.reduce((sum, account) => {
    const ledger = data.expenseLedgers.get(account.id);
    if (!ledger) return sum;
    const periodNet = ledger.lines.reduce((ledgerSum, line) => {
      if (!isWithinRange(line.date, fromTs, toTs)) return ledgerSum;
      return ledgerSum + parseNumber(line.debit_base) - parseNumber(line.credit_base);
    }, 0);
    return sum + periodNet;
  }, 0);

  const totalRevenue = salesTotal + closingInventory + purchaseReturnsTotal;
  const totalLiabilities = openingInventory + purchaseTotal + salesReturnsTotal;
  const grossProfit = totalRevenue - totalLiabilities;
  const netProfit = grossProfit - totalExpenses;

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
        { label: `إجمالي المصاريف`, value: totalExpenses },
      ],
    },
  ];

  return {
    salesTotal,
    purchaseTotal,
    purchaseReturnsTotal,
    salesReturnsTotal,
    openingInventory,
    closingInventory,
    totalExpenses,
    totalRevenue,
    totalLiabilities,
    grossProfit,
    netProfit,
    salesCount: postedSales.length,
    purchaseCount: postedPurchases.length,
    expenseAccountsCount: data.expenseLedgers.size,
    sections,
  };
}
