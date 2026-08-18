import type { JournalEntryDto } from "@erp/shared-types";
import { computeGlAccountNets } from "@modules/reports/lib/glAccountNets";

/**
 * THE single authoritative inventory valuation (periodic model).
 *
 * In this system regular invoice posting never touches the GL inventory
 * accounts — sales post `Dr AR/Cash, Cr 311/312` and purchases post
 * `Dr 41, Cr Supplier` (`unified_invoice/post.rs`). The GL inventory accounts
 * are only written by the adjustment / damaged / stock-adjustment modules. The
 * real valuation therefore lives in the stock-movements module, computed by
 * proxy: opening balance + period in/out (periodic), excluding Adjustment /
 * Damaged / Transfer movements (which flow through the 331/45 GL adjustments
 * instead), then adjusted by the GL-based settlement gains (331) and losses
 * (45).
 *
 * Dashboard "المخزون" and Income Statement "بضاعة آخر المدة" BOTH consume
 * this projection — never two different numbers from two different sources.
 */

export interface InventoryInputMovement {
  movement_type: string;
  movement_date: string;
  total_cost?: string | null;
  total_cost_base?: string | null;
  is_inflow?: boolean | null;
  signed_quantity?: string | null;
}

export interface InventoryProjection {
  openingInventory: number;
  closingInventory: number;
}

export interface InventoryAdjustments {
  gains: number;
  losses: number;
}

const INFLOW_TYPES = new Set(["In", "OpeningBalance", "Purchase", "SalesReturn"]);
const OUTFLOW_TYPES = new Set(["Out", "Damaged", "Sale", "Adjustment", "PurchaseReturn"]);

/** Signed inventory movement value in base currency.
 *
 * `is_inflow` (from the per-material detail feed) wins when present;
 * otherwise the sign is derived from `signed_quantity` and then from the
 * movement type (the flat `StockMovement[]` feed has no `is_inflow` field). */
export function movementSignedValue(movement: InventoryInputMovement): number {
  if (movement.movement_type === "Transfer") return 0;
  const base = parseFloat(movement.total_cost_base ?? "");
  const orig = parseFloat(movement.total_cost ?? "");
  const value = base !== 0 && Number.isFinite(base) ? base : (Number.isFinite(orig) ? orig : 0);
  if (Number.isNaN(value)) return 0;

  let inflow: boolean | undefined = movement.is_inflow != null ? movement.is_inflow : undefined;
  if (inflow === undefined) {
    const sq = parseFloat(movement.signed_quantity ?? "");
    if (Number.isFinite(sq) && sq !== 0) {
      inflow = sq > 0;
    } else {
      inflow = INFLOW_TYPES.has(movement.movement_type) && !OUTFLOW_TYPES.has(movement.movement_type);
    }
  }
  return inflow ? value : -value;
}

/** Inventory settlement adjustments from the posted ledger (331 vs 45). */
export function inventoryAdjustmentNets(entries: JournalEntryDto[]): InventoryAdjustments {
  const nets = computeGlAccountNets(entries);
  return { gains: nets.netByCodes(["331"]), losses: nets.netByCodes(["45"]) };
}

/** Period projection that Dashboard and Income Statement share for the SAME
 * as-of `toTs`. `fromTs` only partitions opening vs period — closing is
 * invariant to it, so the Dashboard (fromTs = all time) and the Income
 * Statement (fromTs = period start) always agree for a shared `toTs`. */
export function computeInventoryProjection(
  movements: InventoryInputMovement[],
  opts: { fromTs: number; toTs: number },
  adjustments?: InventoryAdjustments,
): InventoryProjection {
  let openingInventory = 0;
  let periodMovements = 0;

  for (const movement of movements) {
    const ts = new Date(movement.movement_date).getTime();
    if (!Number.isFinite(ts) || ts > opts.toTs) continue;

    // Opening balance: dedicated OpeningBalance movements plus all movements
    // strictly before the period start.
    if (movement.movement_type === "OpeningBalance") {
      openingInventory += movementSignedValue(movement);
    } else if (ts < opts.fromTs) {
      openingInventory += movementSignedValue(movement);
    }

    // Period movements: within [from, to], excluding the OpeningBalance and
    // the Adjustment / Damaged rows (these flow through the 331/45 GL nets).
    if (ts >= opts.fromTs && ts <= opts.toTs) {
      const isAdjustmentOrDamage = movement.movement_type === "Adjustment" || movement.movement_type === "Damaged";
      if (movement.movement_type !== "OpeningBalance" && !isAdjustmentOrDamage) {
        periodMovements += movementSignedValue(movement);
      }
    }
  }

  const gains = adjustments?.gains ?? 0;
  const losses = adjustments?.losses ?? 0;
  const closingInventory = openingInventory + periodMovements + gains - losses;

  return { openingInventory, closingInventory };
}