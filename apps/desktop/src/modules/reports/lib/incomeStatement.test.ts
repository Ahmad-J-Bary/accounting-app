import { describe, it, expect } from "vitest";
import { computeIncomeStatement, emptyIncomeStatementData } from "./incomeStatement";
import type { AccountDto, JournalEntryDto, JournalLineDto, StockMovementDetailDto } from "@erp/shared-types";

const filters = { from_date: "2026-01-01", to_date: "2026-08-04" };

function account(overrides: Partial<AccountDto> & { code: string }): AccountDto {
  return {
    id: overrides.id ?? `acc-${overrides.code}`,
    code: overrides.code,
    name_ar: overrides.name_ar ?? `حساب ${overrides.code}`,
    name_en: "",
    account_type: "Expenses",
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

const CASH = account({ id: "cash", code: "122", name_ar: "الصندوق", account_type: "Assets", purpose: "general" });
const AR = account({ id: "ar", code: "1203", name_ar: "ذمم عملاء", account_type: "Assets", purpose: "receivable" });
const AP = account({ id: "ap", code: "2203", name_ar: "ذمم موردين", account_type: "Liabilities", purpose: "payable" });
const REV311 = account({ id: "rev311", code: "311", name_ar: "المبيعات", account_type: "Revenue" });
const REV312 = account({ id: "rev312", code: "312", name_ar: "المبيعات الآجلة", account_type: "Revenue" });
const PURCH = account({ id: "purch", code: "41", name_ar: "المشتريات", account_type: "Expenses" });
const DEPRECIATION = account({ id: "acc-46", code: "46", name_ar: "مصروف الإهلاك", account_type: "Expenses" });

const EXP1 = account({ id: "exp1", code: "4301", name_ar: "مصاريف الرواتب" });
const EXP2 = account({ id: "exp2", code: "4302", name_ar: "مصاريف الإيجارات" });
const ROOT_EXP = account({ id: "exp9", code: "49", name_ar: "مصاريف عامة" });

const ACC: Record<string, AccountDto> = {};
for (const acc of [CASH, AR, AP, REV311, REV312, PURCH, DEPRECIATION, EXP1, EXP2, ROOT_EXP]) {
  ACC[acc.id] = acc;
}

function line(accountId: string, debit: number, credit: number): JournalLineDto {
  const acc = ACC[accountId];
  return {
    account_id: accountId,
    account_code: acc?.code ?? "0",
    account_name: acc?.name_ar ?? "حساب",
    account_purpose: acc?.purpose,
    account_type: acc?.account_type,
    partner_id: undefined,
    currency: "S",
    fx_rate: "1",
    debit: String(debit),
    credit: String(credit),
    debit_base: String(debit),
    credit_base: String(credit),
    description: "",
  };
}

function entry(lines: JournalLineDto[], date: string, description = "قيد", overrides: Partial<JournalEntryDto> = {}): JournalEntryDto {
  return {
    id: `e-${lines.map((l) => l.account_code).join("-")}-${date}`,
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

function expense(date: string, amount: number, expenseAccountId = "exp1") {
  return entry([line(expenseAccountId, amount, 0), line("cash", 0, amount)], date, "سند مصروف");
}

function movement(overrides: Partial<StockMovementDetailDto> & { movement_date: string; total_cost_base: string; is_inflow?: boolean }): StockMovementDetailDto {
  return {
    id: "m",
    material_id: "mat1",
    movement_type: "Purchase",
    movement_type_label: "مشتريات",
    quantity: "1",
    unit_cost: overrides.total_cost_base,
    unit_cost_base: overrides.total_cost_base,
    total_cost: overrides.total_cost_base,
    total_cost_base: overrides.total_cost_base,
    currency: "S",
    fx_rate: "1",
    reference: "r",
    notes: "",
    movement_date: overrides.movement_date,
    invoice_number: undefined,
    invoice_type: undefined,
    party_name: undefined,
    warehouse_id: undefined,
    warehouse_name: undefined,
    balance_before: "0",
    balance_after: "0",
    is_inflow: overrides.is_inflow ?? true,
    ...overrides,
  };
}

function computeWith(opts: { entries?: JournalEntryDto[]; accounts?: AccountDto[]; movements?: StockMovementDetailDto[] }) {
  return computeIncomeStatement(filters, {
    ...emptyIncomeStatementData,
    accounts: opts.accounts ?? [CASH, AR, AP, REV311, REV312, PURCH, DEPRECIATION, EXP1, EXP2, ROOT_EXP],
    entries: opts.entries ?? [],
    stockMovementsByMaterial: new Map(opts.movements ? [["m1", opts.movements]] : []),
  });
}

describe("computeIncomeStatement — إجمالي المصاريف (من الترحيل المحاسبي)", () => {
  it("مجموع المصاريف يظهر حركات الفترة من حسابات المصاريف", () => {
    const result = computeWith({
      entries: [expense("2026-02-10", 20), expense("2026-02-11", 30, "exp2")],
    });
    expect(result.totalExpenses).toBe(50);
    expect(result.expenseRows).toEqual([
      { label: "مصاريف الإيجارات", value: 30 },
      { label: "مصاريف الرواتب", value: 20 },
    ]);
  });

  it("يستبعد حسابات التشغيل الخاصة (41/42/44/45) ويُضيف الإهلاك (46) على سطر منفصل — لا تكرار", () => {
    const salesReturns = account({ id: "acc-42", code: "42", name_ar: "مرتجع المبيعات" });
    const drawings = account({ id: "acc-44", code: "44", name_ar: "مسحوبات" });
    const adjustmentLosses = account({ id: "acc-45", code: "45", name_ar: "تسويات مخزون" });
    const result = computeWith({
      accounts: [CASH, salesReturns, drawings, adjustmentLosses, DEPRECIATION, EXP1, PURCH],
      entries: [
        expense("2026-02-10", 20),               // مصاريف تشغيل 20
        expense("2026-02-10", 60, "purch"),      // مشتريات 60 → قسم المتاجرة
        expense("2026-02-10", 10, "acc-42"),     // مرتجع مبيعات → قسم المتاجرة
        expense("2026-02-10", 5, "acc-44"),      // مسحوبات → contra-equity
        expense("2026-02-10", 8, "acc-45"),      // خسائر تسوية مخزون → بضاعة آخر المدة
        expense("2026-02-10", 12, "acc-46"),     // إهلاك → سطر منفصل
      ],
    });
    expect(result.expenseRows.map((r) => r.label)).toEqual(["مصاريف الرواتب"]);
    // إجمالي المصاريف = التشغيل (20) + الإهلاك (12) فقط
    expect(result.totalExpenses).toBe(32);
  });

  it("يُدرج حساب مصاريف أنشئ تحت الجذر مباشرة (خارج الأبوة الثابتة 43)", () => {
    const result = computeWith({
      accounts: [CASH, ROOT_EXP, EXP1],
      entries: [expense("2026-02-10", 15, "exp9")],
    });
    expect(result.totalExpenses).toBe(15);
  });

  it("قيد فترة عادي يحتوي عبارة «رصيد افتتاحي» في بيانه يبقى قيد فترة (لا يُعاد تصنيفه افتتاحاً)", () => {
    const result = computeWith({
      entries: [
        entry([line("exp1", 25, 0), line("cash", 0, 25)], "2026-02-10", "تسوية رصيد افتتاحي للسنة الجديدة"),
      ],
    });
    expect(result.totalExpenses).toBe(25);
  });

  it("المصاريف خارج نطاق الفترة لا تدخل في الإجمالي", () => {
    const result = computeWith({ entries: [expense("2025-12-31", 40)] });
    expect(result.totalExpenses).toBe(0);
  });

  it("المبيعات والمشتريات تُؤخذ من الترحيل: إيراد 311/312 والمشتريات من 41", () => {
    const result = computeWith({
      accounts: [CASH, AR, AP, REV311, REV312, PURCH, EXP1],
      entries: [
        entry([line("cash", 100, 0), line("rev311", 0, 100)], "2026-02-10", "إثبات مبيعات فاتورة رقم 1"),
        entry([line("ar", 150, 0), line("rev312", 0, 150)], "2026-02-11", "إثبات مبيعات آجلة فاتورة رقم 2"),
        entry([line("purch", 60, 0), line("ap", 0, 60)], "2026-02-12", "فاتورة المشتريات رقم 3"),
      ],
    });
    expect(result.salesTotal).toBe(250);
    expect(result.purchaseTotal).toBe(60);
  });

  it("بضاعة أول/آخر المدة من حركات المخزون المشتركة (نفس إسقاط لوحة التحكم)", () => {
    const result = computeWith({
      entries: [],
      movements: [
        movement({ movement_date: "2026-01-01", total_cost_base: "120", is_inflow: true, movement_type: "OpeningBalance" }),
        movement({ movement_date: "2026-06-01", total_cost_base: "60", is_inflow: true, movement_type: "Purchase" }),
      ],
    });
    expect(result.openingInventory).toBe(120);
    expect(result.closingInventory).toBe(180);
  });
});