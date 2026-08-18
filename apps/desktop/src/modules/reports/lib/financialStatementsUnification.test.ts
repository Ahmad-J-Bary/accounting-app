import { describe, it, expect } from "vitest";
import { computeLedgerTotals } from "./ledgerTotals";
import { computeBalanceSheet } from "./balanceSheet";
import { computeIncomeStatement, emptyIncomeStatementData } from "./incomeStatement";
import { computeInventoryProjection } from "./inventory";
import type { AccountDto, JournalEntryDto, JournalLineDto, StockMovementDetailDto } from "@erp/shared-types";

export const PERIOD = { from_date: "2026-01-01", to_date: "2026-12-31" };

const OPENING_DATE = "2026-01-01T00:00:00Z";

function account(overrides: Partial<AccountDto> & { code: string }): AccountDto {
  return {
    id: overrides.id ?? `acc-${overrides.code}`,
    code: overrides.code,
    name_ar: overrides.name_ar ?? `حساب ${overrides.code}`,
    name_en: "",
    account_type: "Assets",
    parent_id: null,
    category: "Detail",
    level: 2,
    opening_balance: "0",
    balance: "0",
    notes: null,
    is_active: true,
    is_default: false,
    is_final: true,
    linked_customer_id: null,
    linked_supplier_id: null,
    debit: "0",
    credit: "0",
    ...overrides,
  };
}

export const CHART: AccountDto[] = [
  account({ id: "ac122", code: "122", name_ar: "الصندوق", account_type: "Assets", purpose: "general" }),
  account({ id: "ac123", code: "123", name_ar: "البنك", account_type: "Assets", purpose: "bank" }),
  account({ id: "ac1203", code: "1203", name_ar: "ذمم عملاء", account_type: "Assets", purpose: "receivable" }),
  account({ id: "ac1204", code: "1204", name_ar: "المخزون", account_type: "Assets", purpose: "inventory" }),
  account({ id: "ac11", code: "11", name_ar: "أصول ثابتة", account_type: "Assets", purpose: "fixed_asset" }),
  account({ id: "ac2203", code: "2203", name_ar: "ذمم موردين", account_type: "Liabilities", purpose: "payable" }),
  account({ id: "ac53", code: "53", name_ar: "قروض", account_type: "Liabilities", purpose: "loan" }),
  account({ id: "ac51", code: "51", name_ar: "رأس المال", account_type: "Equity", purpose: "partner_capital" }),
  account({ id: "ac52", code: "52", name_ar: "أرباح مبقاة", account_type: "Equity", purpose: "retained_earnings" }),
  account({ id: "ac41", code: "41", name_ar: "المشتريات", account_type: "Expenses" }),
  account({ id: "ac311", code: "311", name_ar: "المبيعات", account_type: "Revenue" }),
  account({ id: "ac312", code: "312", name_ar: "المبيعات الآجلة", account_type: "Revenue" }),
  account({ id: "ac4301", code: "4301", name_ar: "مصاريف الرواتب", account_type: "Expenses" }),
  account({ id: "ac4302", code: "4302", name_ar: "مصاريف الإيجارات", account_type: "Expenses" }),
];

const ACC = new Map(CHART.map((a) => [a.id, a]));

function line(accountId: string, debit: number, credit: number, description = ""): JournalLineDto {
  const acc = ACC.get(accountId)!;
  return {
    account_id: accountId,
    account_code: acc.code,
    account_name: acc.name_ar,
    account_purpose: acc.purpose,
    account_type: acc.account_type,
    partner_id: undefined,
    currency: "S",
    fx_rate: "1",
    debit: String(debit),
    credit: String(credit),
    debit_base: String(debit),
    credit_base: String(credit),
    description,
  };
}

function entry(lines: JournalLineDto[], date: string, description: string, overrides: Partial<JournalEntryDto> = {}): JournalEntryDto {
  return {
    id: `e-${description}-${date}`,
    entry_number: "1",
    journal_type: "GeneralJournal",
    journal_type_display: "اليومية العامة",
    source_id: undefined,
    source_type: undefined,
    reversal_of_entry_id: undefined,
    lines,
    entry_date: date,
    description,
    status: "Posted",
    total_base_debit: String(lines.reduce((s, l) => s + parseFloat(l.debit_base ?? l.debit), 0)),
    total_base_credit: String(lines.reduce((s, l) => s + parseFloat(l.credit_base ?? l.credit), 0)),
    created_at: date,
    updated_at: date,
    ...overrides,
  };
}

/** Opening position: Assets 465 (Cash 25, Bank 40, AR 80, Inventory 120, FA
 * 200), Liabilities 120 (AP 70, Loan 50), Equity 345 (Capital 300, RE 45). */
function openingEntry(): JournalEntryDto {
  return entry(
    [
      line("ac122", 25, 0, "الصندوق"),
      line("ac123", 40, 0, "البنك"),
      line("ac1203", 80, 0, "ذمم عملاء"),
      line("ac1204", 120, 0, "المخزون"),
      line("ac11", 200, 0, "أصول ثابتة"),
      line("ac2203", 0, 70, "ذمم موردين"),
      line("ac53", 0, 50, "قروض"),
      line("ac51", 0, 300, "رأس المال"),
      line("ac52", 0, 45, "أرباح مبقاة"),
    ],
    OPENING_DATE,
    "رصيد افتتاحي للفترة",
    { journal_type: "AccountOpeningBalance", source_id: "opening_balance:migration-1" },
  );
}

function cashSale(): JournalEntryDto {
  return entry([line("ac122", 100, 0), line("ac311", 0, 100)], "2026-02-10", "إثبات مبيعات نقدية فاتورة رقم 1");
}

function creditSale(): JournalEntryDto {
  return entry([line("ac1203", 150, 0), line("ac312", 0, 150)], "2026-02-11", "إثبات مبيعات آجلة فاتورة رقم 2");
}

function expenseEntry(accountId: string, amount: number, date: string) {
  return entry([line(accountId, amount, 0), line("ac122", 0, amount)], date, `سند مصروف ${accountId} ${amount}`);
}

function purchaseEntry(): JournalEntryDto {
  return entry([line("ac41", 60, 0), line("ac2203", 0, 60)], "2026-03-01", "فاتورة المشتريات رقم 3");
}

function openingMovement(): StockMovementDetailDto {
  return {
    id: "ob-1",
    material_id: "mat1",
    movement_type: "OpeningBalance",
    movement_type_label: "فاتورة أول المدة",
    quantity: "10",
    unit_cost: "12",
    unit_cost_base: "12",
    total_cost: "120",
    total_cost_base: "120",
    currency: "S",
    fx_rate: "1",
    reference: "OB-1",
    notes: "",
    movement_date: OPENING_DATE,
    invoice_number: undefined,
    invoice_type: undefined,
    party_name: undefined,
    warehouse_id: undefined,
    warehouse_name: undefined,
    balance_before: "0",
    balance_after: "0",
    is_inflow: true,
  };
}

function sums(totals: ReturnType<typeof computeLedgerTotals>) {
  let openingDebit = 0;
  let openingCredit = 0;
  let periodDebit = 0;
  let periodCredit = 0;
  for (const { openingDebit: od, openingCredit: oc, periodDebit: pd, periodCredit: pc } of totals.ledgerTotals.values()) {
    openingDebit += od;
    openingCredit += oc;
    periodDebit += pd;
    periodCredit += pc;
  }
  return { openingDebit, openingCredit, periodDebit, periodCredit };
}

function isData(entries: JournalEntryDto[]) {
  return {
    ...emptyIncomeStatementData,
    accounts: CHART,
    entries,
    stockMovementsByMaterial: new Map([["mat1", [openingMovement()]]]),
  };
}

describe("Unified financial reporting (acceptance scenario)", () => {
  const opening = openingEntry();
  const ops = [cashSale(), creditSale(), expenseEntry("ac4301", 20, "2026-02-20"), expenseEntry("ac4302", 30, "2026-02-21"), purchaseEntry()];

  it("قائمة الدخل: إيراد 250، مشتريات 60، مصاريف 50، مخزون أول وآخر = 120", () => {
    const result = computeIncomeStatement(PERIOD, isData([opening, ...ops]));
    expect(result.salesTotal).toBe(250);
    expect(result.purchaseTotal).toBe(60);
    expect(result.totalExpenses).toBe(50);
    expect(result.openingInventory).toBe(120);
    expect(result.closingInventory).toBe(120);
    expect(result.netProfit).toBe(190 - 50);
  });

  it("إجمالي المصاريف يتبع الترحيل تدريجياً: 0 → 20 → 50 → 60 → 75 (ثابت بعد إعادة الحساب/التنقل)", () => {
    const base = [opening, cashSale(), creditSale(), purchaseEntry()];
    const e1 = expenseEntry("ac4301", 20, "2026-02-20");
    const e2 = expenseEntry("ac4302", 30, "2026-02-21");
    const e3 = expenseEntry("ac4301", 10, "2026-02-22");
    const e4 = expenseEntry("ac4302", 15, "2026-02-23");

    const totalExtra = (extra: JournalEntryDto[]) =>
      computeIncomeStatement(PERIOD, isData([...base, ...extra])).totalExpenses;

    // After opening + sales + purchase but before ANY expense → 0
    expect(totalExtra([])).toBe(0);
    // Then 20, 50, 60, 75 as each expense journal is posted
    expect(totalExtra([e1])).toBe(20);
    expect(totalExtra([e1, e2])).toBe(50);
    expect(totalExtra([e1, e2, e3])).toBe(60);
    expect(totalExtra([e1, e2, e3, e4])).toBe(75);
    // Same number after a fresh recomputation (= navigation / restart)
    expect(totalExtra([e1, e2, e3, e4])).toBe(75);
  });

  it("ميزان المراجعة: إجمالي الخصوم = إجمالي الدائن (افتتاح وفترة)", () => {
    const totals = computeLedgerTotals(CHART, [opening, ...ops], PERIOD.from_date, PERIOD.to_date);
    const s = sums(totals);
    expect(s.openingDebit).toBe(s.openingCredit);
    expect(s.periodDebit).toBe(s.periodCredit);
    expect(s.openingDebit).toBe(465);
    expect(s.periodDebit).toBe(360);
  });

  it("الميزانية العمومية: الأصول = الخصوم + حقوق الملكية (بدون تسويات خاصة)", () => {
    const ledger = computeLedgerTotals(CHART, [opening, ...ops], PERIOD.from_date, PERIOD.to_date);
    const is = computeIncomeStatement(PERIOD, isData([opening, ...ops]));
    const bs = computeBalanceSheet(
      CHART,
      { netProfit: is.netProfit, totalDrawings: ledger.totalDrawings },
      ledger.ledgerTotals,
      { closingInventory: is.closingInventory },
    );
    expect(bs.totalAssets).toBe(665);
    expect(bs.totalLiabilities).toBe(180);
    expect(bs.totalEquity).toBe(485);
    expect(bs.isBalanced).toBe(true);
  });

  it("مخزون لوحة التحكم == بضاعة آخر المدة لنفس التاريخ (نفس الإسقاط)", () => {
    const toTs = new Date("2026-12-31T23:59:59Z").getTime();
    const movements = [openingMovement()];
    const dashboard = computeInventoryProjection(movements, { fromTs: 0, toTs });
    const statement = computeInventoryProjection(
      movements,
      { fromTs: new Date(PERIOD.from_date).getTime(), toTs },
    );
    expect(dashboard.closingInventory).toBe(120);
    expect(statement.closingInventory).toBe(dashboard.closingInventory);
    expect(computeIncomeStatement(PERIOD, isData([opening, ...ops])).closingInventory).toBe(120);
  });
});