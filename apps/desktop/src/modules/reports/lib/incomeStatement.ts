import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import { startOfDay, endOfDay, isWithinRange } from "@modules/reports/lib/date-utils";
import { getOpeningTotals, isOpeningLine } from "@modules/accounting/account-movements/lib/openingLines";
import type { ReportFilters } from "@shared/types/filters";
import type {
  AccountDto,
  AccountLedgerDto,
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
  expenseAccounts: AccountDto[];
  expenseLedgers: Map<string, AccountLedgerDto>;
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
  expenseAccounts: [],
  expenseLedgers: new Map(),
  stockMovementsByMaterial: new Map(),
  materials: [],
  accounts: [],
  entries: [],
};

export function parseNumber(value?: string | number | null) {
  return parseSafeNumber(value);
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

  // Discounts granted = sum of line-level discounts from posted sales invoices
  const discountsGranted = postedSales.reduce((sum, invoice) => {
    const v2 = parseNumber(invoice.discount_amount_v2?.base_amount);
    const disc = v2 > 0 ? v2 : (parseNumber(invoice.discount_amount) / (parseNumber(invoice.exchange_rate) || 1));
    return sum + disc;
  }, 0);

  // Discounts earned = sum of line-level discounts from posted purchase invoices
  const discountsEarned = postedPurchases.reduce((sum, invoice) => {
    const v2 = parseNumber(invoice.discount_amount_v2?.base_amount);
    const disc = v2 > 0 ? v2 : (parseNumber(invoice.discount_amount) / (parseNumber(invoice.exchange_rate) || 1));
    return sum + disc;
  }, 0);

  // 1. استثناء التسويات والتالف من حركات المخزون الفعلية للحصول على بضاعة آخر المدة قبل التسوية
  const isAdjustmentOrDamage = (type: string) => type === "Adjustment" || type === "Damaged";

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

  const periodMovementsBefore = Array.from(data.stockMovementsByMaterial.values()).reduce((sum, movements) => {
    const movementTotal = movements.reduce((materialSum, movement) => {
      const movementTs = new Date(movement.movement_date).getTime();
      if (!Number.isFinite(movementTs) || movementTs < fromTs || movementTs > toTs) {
        return materialSum;
      }
      if (movement.movement_type === "OpeningBalance" || isAdjustmentOrDamage(movement.movement_type)) {
        return materialSum;
      }
      return materialSum + getSignedMovementValue(movement);
    }, 0);
    return sum + movementTotal;
  }, 0);

  const closingInventoryBefore = openingInventory + periodMovementsBefore;

  // 2. حساب القيم التشغيلية للحسابات المخصصة من قيود اليومية للفترة المحددة
  const accountMap = new Map((data.accounts || []).map((acc) => [acc.id, acc]));
  const entries = data.entries || [];

const getAccountPeriodNet = (predicate: (acc?: AccountDto) => boolean, revenueSide: boolean) => {
    let debit = 0;
    let credit = 0;
    for (const entry of entries) {
      if (!isWithinRange(entry.entry_date, fromTs, toTs)) continue;
      for (const line of entry.lines) {
        const acc = accountMap.get(line.account_id);
        if (acc && predicate(acc)) {
          debit += parseFloat(line.debit_base || line.debit || "0");
          credit += parseFloat(line.credit_base || line.credit || "0");
        }
      }
    }
    // حسابات الإيرادات/المقابلات (أرقام تبدأ بـ 3) تُعامل عكسياً: رصيدها دائن
    if (revenueSide) {
      return credit - debit;
    }
    return debit - credit;
  };

  const SYSTEM_DEPRECIATION_ID = "00000000-0000-0000-0000-000000000046";
  const matchCode = (codes: string[]) => (acc: AccountDto) => codes.includes(acc.code);

  const adjustmentGains = getAccountPeriodNet(matchCode(["331"]), true);
  const adjustmentLosses = getAccountPeriodNet(matchCode(["45"]), false);
  const depreciationExpense = getAccountPeriodNet(
    (acc) => acc.id === SYSTEM_DEPRECIATION_ID || acc.code === "46",
    false,
  );

  // 3. احتساب بضاعة آخر المدة النهائية بعد التسويات والتالف
  const closingInventory = closingInventoryBefore + adjustmentGains - adjustmentLosses;

  // 4. مصاريف التشغيل الأساسية من API المصاريف
  const baseExpenseRows = data.expenseAccounts
    .map((account) => {
      const ledger = data.expenseLedgers.get(account.id);
      if (!ledger) return { label: account.name_ar, value: 0 };
      // حركة الفترة (يُستثنى منها الرصيد الافتتاحي لعدم تكرار الاحتساب)
      const periodNet = ledger.lines.reduce((ledgerSum, line) => {
        if (isOpeningLine(line)) return ledgerSum;
        if (!isWithinRange(line.date, fromTs, toTs)) return ledgerSum;
        return ledgerSum + parseNumber(line.debit_base) - parseNumber(line.credit_base);
      }, 0);
      // الرصيد الافتتاحي لبند المصروف يُضاف إلى إجمالي المصاريف
      const opening = getOpeningTotals(ledger.lines, undefined, filters.to_date);
      const openingNet = opening.debit - opening.credit;
      const staticOpening = parseNumber(ledger.opening_balance_base);
      return {
        label: account.name_ar,
        value: periodNet + (openingNet !== 0 ? openingNet : staticOpening),
      };
    })
    .filter((r) => r.value !== 0);

  // 5. إجمالي المصاريف = مصاريف التشغيل الأساسية + مصروف الإهلاك السنوي
  const expenseRows = [...baseExpenseRows];
  const totalExpenses = expenseRows.reduce((s, r) => s + r.value, 0) + depreciationExpense;

  // 6. حساب مجاميع المتاجرة (باستخدام بضاعة آخر المدة بعد التسوية لتتدفق التسويات عبر المخزون → COGS)
  const totalRevenue = salesTotal + closingInventory + purchaseReturnsTotal + discountsEarned;
  const totalLiabilities = openingInventory + purchaseTotal + salesReturnsTotal + discountsGranted;
  const grossProfit = totalRevenue - totalLiabilities;

  // 7. صافي الأرباح (أثر التسويات ضمن مجمل الربح عبر بضاعة آخر المدة)
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
        { label: `إجمالي المصاريف`, value: totalExpenses },
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
