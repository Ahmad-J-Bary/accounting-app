// Pure derivation functions: turn owning-module DTOs into the wizard's
// read-only "derived" opening lines. No hooks, no services — unit-testable.
import type { AccountDto, CustomerDto, SupplierDto, PartnerDto, FixedAssetDto, MaterialDto, AssetCategoryDto } from "@erp/shared-types";
import type { DerivedRow } from "./wizard-types";
import { toNum } from "./wizard-types";
import { toFixed, fmtMoney } from "@shared/lib/format";

function codeOf(accounts: readonly AccountDto[], id?: string | null): string {
  return id ? accounts.find((a) => a.id === id)?.code || "" : "";
}

export function deriveAr(customers: readonly CustomerDto[], accounts: readonly AccountDto[]): DerivedRow[] {
  return customers
    .filter((c) => c.account_id && toNum(c.opening_balance) !== 0)
    .map((c) => ({
      key: `ar_${c.id}`,
      entity_id: c.id,
      label: `${c.code || ""} — ${c.name}`,
      account_id: c.account_id as string,
      account_code: codeOf(accounts, c.account_id),
      amount: String(toNum(c.opening_balance)),
      kind: "AR" as const,
    }));
}

export function deriveAp(suppliers: readonly SupplierDto[], accounts: readonly AccountDto[]): DerivedRow[] {
  return suppliers
    .filter((s) => s.account_id && toNum(s.opening_balance) !== 0)
    .map((s) => ({
      key: `ap_${s.id}`,
      entity_id: s.id,
      label: `${s.code || ""} — ${s.name}`,
      account_id: s.account_id as string,
      account_code: codeOf(accounts, s.account_id),
      amount: String(toNum(s.opening_balance)),
      kind: "AP" as const,
    }));
}

export function deriveFa(fixedAssets: readonly FixedAssetDto[], accounts: readonly AccountDto[], categories: readonly AssetCategoryDto[] = []): DerivedRow[] {
  const catMap = new Map<string, string>();
  for (const c of categories) catMap.set(c.id, c.name);

  return fixedAssets
    .filter((a) => a.status === "Active" && a.asset_account_id)
    .map((a) => ({
      key: `fa_${a.id}`,
      entity_id: a.id,
      label: `${a.code || ""} — ${a.name}`,
      account_id: a.asset_account_id as string,
      account_code: codeOf(accounts, a.asset_account_id),
      amount: String(toNum(a.purchase_cost?.amount) - toNum(a.accumulated_depreciation?.amount)),
      kind: "FixedAsset" as const,
      category: catMap.get(a.category_id) || "",
    }))
    .filter((r) => toNum(r.amount) !== 0);
}

export function derivePartnerEquity(partners: readonly PartnerDto[], accounts: readonly AccountDto[]): DerivedRow[] {
  return partners
    .filter((p) => p.linked_account_id && toNum(p.amount_local) !== 0)
    .map((p) => ({
      key: `eq_${p.id}`,
      entity_id: p.id,
      label: `${p.code || ""} — ${p.name}`,
      account_id: p.linked_account_id as string,
      account_code: codeOf(accounts, p.linked_account_id),
      amount: String(toNum(p.amount_local)),
      kind: "Equity" as const,
    }));
}

export function derivePartnerCurrentAccounts(partners: readonly PartnerDto[], accounts: readonly AccountDto[]): DerivedRow[] {
  return partners
    .filter((p) => p.current_account_id)
    .map((p) => ({
      key: `pc_${p.id}`,
      entity_id: p.id,
      label: `${p.code || ""} — ${p.name} (جاري)`,
      account_id: p.current_account_id as string,
      account_code: codeOf(accounts, p.current_account_id),
      amount: "0",
      kind: "Equity" as const,
    }));
}

export interface InventoryRow {
  name: string;
  available: number;
  value: number;
}

// Editable per-material opening-stock entry used by the wizard's inventory
// section to build the opening invoice and the migration line + items.
export interface InventoryEntry {
  material_id: string;
  code: string;
  name: string;
  default_warehouse_id: string | null;
  default_unit_id: string | null;
  qty: string;
  cost: string;
  value: number;
}

export function deriveInventoryRows(materials: readonly MaterialDto[]): InventoryEntry[] {
  return materials.map((m) => {
    const qty = toNum(m.total_available);
    const cost = toNum(m.average_cost_base) || toNum(m.last_purchase_price_base);
    return {
      material_id: m.id,
      code: m.code || "",
      name: m.name,
      default_warehouse_id: m.default_warehouse_id ?? null,
      default_unit_id: m.default_purchase_unit_id ?? null,
      qty: String(qty || ""),
      cost: String(cost || ""),
      value: qty * cost,
    };
  });
}

export function inventorySummary(materials: readonly MaterialDto[]): { rows: InventoryRow[]; total: number; count: number } {
  const rows = materials
    .map((m) => ({
      name: m.name,
      available: toNum(m.total_available),
      value: toNum(m.total_available) * toNum(m.average_cost_base),
    }))
    .filter((r) => r.available !== 0);
  return {
    rows,
    total: rows.reduce((s, r) => s + r.value, 0),
    count: rows.length,
  };
}

export function sumLines(list: readonly { amount?: string }[]): number {
  return list.reduce((s, l) => s + toNum(l.amount), 0);
}

/**
 * Pre-save smart hints for §14: point the accountant at incomplete inventory
 * rows or a divergence between the material-card stock value and the opening
 * inventory value, before any reconciliation is run.
 */
export function inventoryMismatchHints(entries: readonly InventoryEntry[], materials: readonly MaterialDto[]): string[] {
  const hints: string[] = [];
  for (const r of entries) {
    const qty = toNum(r.qty);
    const cost = toNum(r.cost);
    if (qty > 0 && cost <= 0) {
      hints.push(
        `المادة «${r.name}» لها كمية ${toFixed(qty, 2)} بدون تكلفة — لن تُضاف إلى قيمة المخزون الافتتاحية؛ أدخل التكلفة.`,
      );
    } else if (cost > 0 && qty <= 0) {
      hints.push(
        `المادة «${r.name}» لها تكلفة ${toFixed(cost, 2)} بدون كمية — لن تُضاف إلى قيمة المخزون الافتتاحية؛ أدخل الكمية.`,
      );
    }
  }
  const cardTotal = inventorySummary(materials).total;
  const openingTotal = entries.reduce((s, r) => s + r.value, 0);
  if (cardTotal > 0 && Math.abs(cardTotal - openingTotal) > 0.01) {
    hints.push(
      `رصيد المخزون في بطاقة المواد (${fmtMoney(cardTotal)}) لا يساوي قيمة المخزون الافتتاحية (${fmtMoney(openingTotal)}) — راجع قسم «المخزون»؛ سيُضاف الرصيد الافتتاحي فوق الرصيد الحالي.`,
    );
  }
  return hints;
}