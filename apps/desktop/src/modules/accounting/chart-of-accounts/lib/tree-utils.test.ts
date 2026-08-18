import { describe, it, expect } from "vitest";
import { buildTree, getVisibleRootTree } from "./tree-utils";
import type { AccountDto } from "@erp/shared-types";
import type { AccountTreeNode } from "./types";

function account(
  code: string,
  name: string,
  type: string,
  parentId: string | null,
  purpose?: string,
): AccountDto {
  return {
    id: `id-${code}`,
    code,
    name_ar: name,
    name_en: name,
    account_type: type,
    parent_id: parentId,
    category: parentId ? "Detail" : "Summary",
    level: code.length,
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
    purpose,
  };
}

/** Canonical chart: loans = 224 under 22 under 2; partner
 *  current (54) and drawings (44) under the equity root (5). */
function canonicalChart(): AccountDto[] {
  const c = (code: string, name: string, type: string, parent: string | null, purpose?: string) =>
    account(code, name, type, parent ? `id-${parent}` : null, purpose);
  return [
    c("1", "الأصول", "Assets", null),
    c("2", "الخصوم", "Liabilities", null),
    c("3", "الإيرادات", "Revenue", null),
    c("4", "المصروفات", "Expenses", null),
    c("5", "حقوق الملكية", "Equity", null),
    c("11", "الأصول الثابتة", "Assets", "1"),
    c("12", "الأصول المتداولة", "Assets", "1"),
    c("21", "الخصوم الثابتة", "Liabilities", "2"),
    c("22", "الخصوم المتداولة", "Liabilities", "2"),
    c("31", "المبيعات", "Revenue", "3"),
    c("33", "إيرادات أخرى", "Revenue", "3"),
    c("41", "المشتريات", "Expenses", "4"),
    c("43", "مصاريف أخرى", "Expenses", "4"),
    c("45", "خسائر المواد التالفة", "Expenses", "4"),
    c("51", "رأس المال", "Equity", "5", "partner_capital"),
    c("52", "الأرباح المبقاة", "Equity", "5", "retained_earnings"),
    c("53", "رصيد افتتاحي", "Equity", "5", "opening_balance_equity"),
    c("54", "حسابات جارية للشركاء", "Equity", "5", "partner_current"),
    c("44", "مسحوبات الشركاء", "Equity", "5", "partner_drawings"),
    c("122", "الصندوق (الخزينة)", "Assets", "12"),
    c("123", "المدينون", "Assets", "12"),
    c("125", "البنوك", "Assets", "12", "bank"),
    c("221", "تكاليف إضافية", "Liabilities", "22"),
    c("223", "الدائنون", "Liabilities", "22"),
    c("224", "القروض", "Liabilities", "22", "loan"),
    c("311", "المبيعات النقدية", "Revenue", "31"),
    c("511", "أحمد", "Equity", "51", "partner_capital"),
    c("512", "محمد", "Equity", "51", "partner_capital"),
    c("541", "حساب جاري أحمد", "Equity", "54", "partner_current"),
    c("542", "حساب جاري محمد", "Equity", "54", "partner_current"),
    c("441", "مسحوبات أحمد", "Equity", "44", "partner_drawings"),
    c("442", "مسحوبات محمد", "Equity", "44", "partner_drawings"),
    c("1231", "عمار", "Assets", "123"),
  ];
}

function flatten(nodes: AccountTreeNode[]): AccountTreeNode[] {
  const out: AccountTreeNode[] = [];
  const visit = (n: AccountTreeNode) => {
    out.push(n);
    n.children.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

describe("buildTree — chart of accounts hierarchy", () => {
  it("produces exactly the five canonical roots ordered by code", () => {
    const roots = buildTree(canonicalChart());
    expect(roots.map((r) => r.code)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("hangs loans (224) under 22 under 2 — never a root", () => {
    const roots = buildTree(canonicalChart());
    const rootCodes = new Set(roots.map((r) => r.code));
    expect(rootCodes.has("224")).toBe(false);

    const liab = roots.find((r) => r.code === "2")!;
    const group22 = liab.children.find((c) => c.code === "22");
    expect(group22?.children.map((c) => c.code)).toEqual(["221", "223", "224"]);

    const loan = group22?.children.find((c) => c.code === "224");
    expect(loan?.name_ar).toBe("القروض");
    expect(loan?.purpose).toBe("loan");
  });

  it("hangs partner current (54) and drawings (44) under the equity root — not under expenses", () => {
    const roots = buildTree(canonicalChart());
    const equity = roots.find((r) => r.code === "5")!;
    const equityChildCodes = equity.children.map((c) => c.code);
    expect(equityChildCodes).toEqual(["44", "51", "52", "53", "54"]);

    const expenses = roots.find((r) => r.code === "4")!;
    expect(expenses.children.map((c) => c.code)).not.toContain("44");

    const current = equity.children.find((c) => c.code === "54")!;
    expect(current.children.map((c) => c.code)).toEqual(["541", "542"]);
    const drawings = equity.children.find((c) => c.code === "44")!;
    expect(drawings.children.map((c) => c.code)).toEqual(["441", "442"]);
  });

  it("builds the partner capital subtree 511/512 under 51 under 5", () => {
    const roots = buildTree(canonicalChart());
    const equity = roots.find((r) => r.code === "5")!;
    const capital = equity.children.find((c) => c.code === "51")!;
    expect(capital.children.map((c) => c.code)).toEqual(["511", "512"]);
  });

  it("keeps every account exactly once with valid parent links", () => {
    const roots = buildTree(canonicalChart());
    const all = flatten(roots);
    const codes = all.map((n) => n.code);
    expect(new Set(codes).size).toBe(codes.length);

    for (const node of all) {
      if (node.parent_id) {
        const parent = all.find((n) => n.id === node.parent_id);
        expect(parent).toBeDefined();
        expect(parent!.children.some((child) => child.id === node.id)).toBe(true);
      }
    }
  });

  it("orders every node's children by code ascending", () => {
    const roots = buildTree(canonicalChart());
    const all = flatten(roots);
    for (const node of all) {
      const codes = node.children.map((c) => c.code);
      expect([...codes].sort((a, b) => a.localeCompare(b))).toEqual(codes);
    }
  });
});

describe("getVisibleRootTree", () => {
  it("keeps only the liability root when searching for the loan account", () => {
    const roots = buildTree(canonicalChart());
    const visible = getVisibleRootTree(roots, "القروض");
    expect(visible.map((r) => r.code)).toEqual(["2"]);
  });

  it("keeps only the equity root when searching for a partner current account", () => {
    const roots = buildTree(canonicalChart());
    const visible = getVisibleRootTree(roots, "541");
    expect(visible.map((r) => r.code)).toEqual(["5"]);
  });
});