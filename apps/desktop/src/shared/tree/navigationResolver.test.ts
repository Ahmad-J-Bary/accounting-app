import { describe, expect, it } from "vitest";
import { SYSTEM_ACCOUNT_IDS, type AccountDto } from "@erp/shared-types";
import { resolveAccountNavigation } from "./navigationResolver";

const ROOT_ID = "__chart_of_accounts_root__";

function account(partial: Partial<AccountDto> & { id: string }): AccountDto {
  return {
    code: "",
    name_ar: "",
    name_en: "",
    account_type: "Assets",
    parent_id: null,
    category: "Summary",
    level: 1,
    opening_balance: "0",
    balance: "0",
    notes: null,
    is_active: true,
    is_default: false,
    is_final: false,
    linked_customer_id: null,
    linked_supplier_id: null,
    debit: "0",
    credit: "0",
    purpose: "general",
    ...partial,
  };
}

describe("resolveAccountNavigation", () => {
  it("keeps the virtual root inert", () => {
    const root = account({ id: ROOT_ID, name_ar: "دليل الحسابات" });
    expect(
      resolveAccountNavigation({ node: root, nodes: [root], rootId: ROOT_ID }),
    ).toEqual({ type: "none" });
  });

  it("routes the customers group to the customers page", () => {
    const node = account({
      id: SYSTEM_ACCOUNT_IDS.CUSTOMERS,
      code: "1230",
      purpose: "receivable",
      name_ar: "المدينون",
    });
    expect(resolveAccountNavigation({ node, nodes: [node], rootId: ROOT_ID })).toEqual({
      type: "specialized-page",
      routeId: "customers",
    });
  });

  it("routes a linked customer account to ledger", () => {
    const root = account({
      id: SYSTEM_ACCOUNT_IDS.CUSTOMERS,
      code: "1230",
      purpose: "receivable",
      name_ar: "المدينون",
    });
    const child = account({
      id: "cust-1",
      code: "12301",
      parent_id: root.id,
      linked_customer_id: "customer-1",
      category: "Detail",
      is_final: true,
      name_ar: "عميل أ",
    });
    expect(resolveAccountNavigation({ node: child, nodes: [root, child], rootId: ROOT_ID })).toEqual({
      type: "ledger",
      accountId: child.id,
    });
  });

  it("routes a supplier child without direct linkage to ledger", () => {
    const root = account({
      id: SYSTEM_ACCOUNT_IDS.SUPPLIERS,
      code: "2230",
      purpose: "payable",
      account_type: "Liabilities",
      name_ar: "الدائنون",
    });
    const child = account({
      id: "supplier-group-child",
      code: "22301",
      parent_id: root.id,
      category: "Summary",
      account_type: "Liabilities",
      name_ar: "موردون فرعيون",
    });
    expect(resolveAccountNavigation({ node: child, nodes: [root, child], rootId: ROOT_ID })).toEqual({
      type: "ledger",
      accountId: child.id,
    });
  });

  it("routes the fixed-assets parent group to the specialized page", () => {
    const group = account({
      id: "fixed-assets-root",
      code: "11",
      purpose: "fixed_asset",
      name_ar: "الأصول الثابتة",
    });
    const child = account({
      id: SYSTEM_ACCOUNT_IDS.FIXED_ASSET_EQUIPMENT,
      code: "112",
      parent_id: group.id,
      purpose: "fixed_asset",
      name_ar: "معدات وتجهيزات",
    });
    expect(resolveAccountNavigation({ node: group, nodes: [group, child], rootId: ROOT_ID })).toEqual({
      type: "specialized-page",
      routeId: "fixed-assets",
    });
  });

  it("routes a fixed-asset account inside the branch to ledger", () => {
    const root = account({
      id: "fixed-assets-root",
      code: "11",
      purpose: "fixed_asset",
      name_ar: "الأصول الثابتة",
    });
    const child = account({
      id: SYSTEM_ACCOUNT_IDS.FIXED_ASSET_AUTOMOTIVE,
      code: "111",
      parent_id: root.id,
      purpose: "fixed_asset",
      category: "Detail",
      is_final: true,
      name_ar: "سيارات",
    });
    expect(resolveAccountNavigation({ node: child, nodes: [root, child], rootId: ROOT_ID })).toEqual({
      type: "ledger",
      accountId: child.id,
    });
  });

  it("routes trade groups by canonical codes only", () => {
    const sales = account({ id: "sales", code: "31", account_type: "Revenue", name_ar: "المبيعات" });
    const purchaseReturns = account({ id: "purchase-returns", code: "32", account_type: "Revenue", name_ar: "مرتجع المشتريات" });
    const purchases = account({ id: "purchases", code: "41", account_type: "Expenses", name_ar: "المشتريات" });
    const salesReturns = account({ id: "sales-returns", code: "42", account_type: "Expenses", name_ar: "مرتجع المبيعات" });

    expect(resolveAccountNavigation({ node: sales, nodes: [sales], rootId: ROOT_ID })).toEqual({
      type: "specialized-page",
      routeId: "sales-invoices",
    });
    expect(resolveAccountNavigation({ node: purchaseReturns, nodes: [purchaseReturns], rootId: ROOT_ID })).toEqual({
      type: "specialized-page",
      routeId: "purchase-returns",
    });
    expect(resolveAccountNavigation({ node: purchases, nodes: [purchases], rootId: ROOT_ID })).toEqual({
      type: "specialized-page",
      routeId: "purchase-invoices",
    });
    expect(resolveAccountNavigation({ node: salesReturns, nodes: [salesReturns], rootId: ROOT_ID })).toEqual({
      type: "specialized-page",
      routeId: "sales-returns",
    });
  });

  it("routes child accounts under sales to ledger", () => {
    const root = account({ id: "sales", code: "31", account_type: "Revenue", name_ar: "المبيعات" });
    const child = account({
      id: "sales-child",
      code: "311",
      parent_id: root.id,
      category: "Detail",
      is_final: true,
      account_type: "Revenue",
      name_ar: "مبيعات نقدية",
    });
    expect(resolveAccountNavigation({ node: child, nodes: [root, child], rootId: ROOT_ID })).toEqual({
      type: "ledger",
      accountId: child.id,
    });
  });

  it("leaves unrelated accounts unchanged", () => {
    const node = account({
      id: "cash",
      code: "1202",
      category: "Detail",
      is_final: true,
      name_ar: "الصندوق",
    });
    expect(resolveAccountNavigation({ node, nodes: [node], rootId: ROOT_ID })).toEqual({
      type: "none",
    });
  });
});
