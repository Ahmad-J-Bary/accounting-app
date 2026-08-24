import { describe, it, expect } from "vitest";
import type { AccountDto, CustomerDto, SupplierDto, FixedAssetDto, PartnerDto, MaterialDto } from "@erp/shared-types";
import { toFixed, fmtMoney } from "@shared/lib/format";
import { deriveAr, deriveAp, deriveFa, derivePartnerEquity, inventorySummary, inventoryMismatchHints, sumLines, type InventoryEntry } from "./derive-rows";

const accounts: AccountDto[] = [
  { id: "a1", code: "1101", name_ar: "عملاء", name_en: "Customers", category: "Detail", account_type: "Assets" },
  { id: "a2", code: "2201", name_ar: "موردون", name_en: "Suppliers", category: "Detail", account_type: "Liabilities" },
] as AccountDto[];

const customers = [
  { id: "c1", code: "C1", name: "عميل واحد", account_id: "a1", opening_balance: "500.00" },
  { id: "c2", code: "C2", name: "دون حساب", account_id: null, opening_balance: "100" },
  { id: "c3", code: "C3", name: "رصيد صفر", account_id: "a1", opening_balance: "0" },
] as CustomerDto[];

describe("deriveAr", () => {
  it("keeps only customers with an account and non-zero balance", () => {
    expect(deriveAr(customers, accounts)).toHaveLength(1);
  });

  it("maps account code and strips the amount to a string", () => {
    const [row] = deriveAr(customers, accounts);
    expect(row).toMatchObject({ key: "ar_c1", entity_id: "c1", account_code: "1101", kind: "AR" });
    expect(row.amount).toBe("500");
  });

  it("returns [] when every customer lacks an account", () => {
    expect(deriveAr([customers[1]], accounts)).toEqual([]);
  });
});

const suppliers = [
  { id: "s1", code: "S1", name: "مورد واحد", account_id: "a2", opening_balance: "-250.5" },
  { id: "s2", code: "S2", name: "بدون حساب", account_id: null, opening_balance: "-5" },
] as SupplierDto[];

describe("deriveAp", () => {
  it("filters and maps suppliers like customers", () => {
    expect(deriveAp(suppliers, accounts)).toHaveLength(1);
    expect(deriveAp(suppliers, accounts)[0]).toMatchObject({ key: "ap_s1", account_code: "2201", kind: "AP", amount: "-250.5" });
  });
});

const fixedAssets = [
  {
    id: "f1",
    code: "FA1",
    name: "حافلة",
    status: "Active",
    asset_account_id: "a1",
    category_id: "cat1",
    purchase_cost: { amount: "1000" },
    accumulated_depreciation: { amount: "200" },
  },
  { id: "f2", code: "FA2", name: "متقاعد", status: "Disposed", asset_account_id: "a1", category_id: "" },
  { id: "f3", code: "FA3", name: "صفر صافٍ", status: "Active", asset_account_id: "a1", category_id: "", purchase_cost: { amount: "100" }, accumulated_depreciation: { amount: "100" } },
] as FixedAssetDto[];

const assetCategories = [
  { id: "cat1", name: "معدات وتجهيزات", asset_type: "Fixed" as const },
];

describe("deriveFa", () => {
  it("computes net book value (cost - depreciation)", () => {
    const rows = deriveFa(fixedAssets, accounts, assetCategories);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe("800");
    expect(rows[0].kind).toBe("FixedAsset");
  });

  it("maps category name from asset categories", () => {
    const rows = deriveFa(fixedAssets, accounts, assetCategories);
    expect(rows[0].category).toBe("معدات وتجهيزات");
  });
});

const partners = [{ id: "p1", code: "P1", name: "شريك أ", linked_account_id: "a2", amount_local: "10000" }] as PartnerDto[];

describe("derivePartnerEquity", () => {
  it("maps a linked partner to its equity line", () => {
    expect(derivePartnerEquity(partners, accounts)[0]).toMatchObject({ key: "eq_p1", account_code: "2201", kind: "Equity", amount: "10000" });
  });
});

const materials = [
  { name: "مادة أ", total_available: "10", average_cost_base: "4.5" },
  { name: "مادة ب", total_available: "0", average_cost_base: "9" },
] as MaterialDto[];

describe("inventorySummary", () => {
  it("ignores zero-available materials and totals the value", () => {
    const s = inventorySummary(materials);
    expect(s.count).toBe(1);
    expect(s.total).toBe(45);
    expect(s.rows[0].name).toBe("مادة أ");
  });
});

describe("sumLines", () => {
  it("treats missing amounts as zero", () => {
    expect(sumLines([{ amount: "10" }, { amount: "2.5" }, {}])).toBe(12.5);
  });
});

function entry(partial: Partial<InventoryEntry>): InventoryEntry {
  return { material_id: "m1", code: "M1", name: "مادة أ", default_warehouse_id: null, default_unit_id: null, qty: "", cost: "", value: 0, ...partial };
}

describe("inventoryMismatchHints", () => {
  it("flags a quantity without a cost so the row is dropped from opening value", () => {
    const hints = inventoryMismatchHints([entry({ qty: "5", cost: "" })], []);
    expect(hints).toEqual([`المادة «مادة أ» لها كمية ${toFixed(5, 2)} بدون تكلفة — لن تُضاف إلى قيمة المخزون الافتتاحية؛ أدخل التكلفة.`]);
  });

  it("flags a cost without a quantity", () => {
    const hints = inventoryMismatchHints([entry({ qty: "", cost: "150" })], []);
    expect(hints).toEqual([`المادة «مادة أ» لها تكلفة ${toFixed(150, 2)} بدون كمية — لن تُضاف إلى قيمة المخزون الافتتاحية؛ أدخل الكمية.`]);
  });

  it("reports the exact §14 mismatch when the card exceeds the opening value", () => {
    const materials = [{ name: "مادة أ", total_available: "10", average_cost_base: "100" }] as MaterialDto[];
    const hints = inventoryMismatchHints([entry({ qty: "5", cost: "100", value: 500 })], materials);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toContain(`(${fmtMoney(1000)})`);
    expect(hints[0]).toContain(`(${fmtMoney(500)})`);
    expect(hints[0]).toContain("لا يساوي قيمة المخزون الافتتاحية");
  });

  it("stays silent when opening creates the card from scratch", () => {
    const materials = [{ name: "مادة أ", total_available: "0", average_cost_base: "100" }] as MaterialDto[];
    expect(inventoryMismatchHints([entry({ qty: "10", cost: "120", value: 1200 })], materials)).toEqual([]);
  });

  it("stays silent on the default prefill where the opening equals the card", () => {
    const materials = [{ name: "مادة أ", total_available: "10", average_cost_base: "100" }] as MaterialDto[];
    expect(inventoryMismatchHints([entry({ qty: "10", cost: "100", value: 1000 })], materials)).toEqual([]);
  });
});