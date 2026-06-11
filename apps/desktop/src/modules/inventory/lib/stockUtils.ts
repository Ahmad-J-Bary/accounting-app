import type { StockMovement, MaterialUnitDto } from "@erp/shared-types";
import { getMovementType } from "../constants/movementTypes";

export function buildStockByWarehouse(movements: StockMovement[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const m of movements) {
    if (!m.warehouse_id) continue;
    const mid = m.material_id;
    const wid = m.warehouse_id;
    const cfg = getMovementType(m.movement_type);
    const qty = parseFloat(m.quantity || "0");
    let mat = map.get(mid);
    if (!mat) {
      mat = new Map();
      map.set(mid, mat);
    }
    mat.set(wid, (mat.get(wid) || 0) + (cfg.inflow ? qty : -qty));
  }
  return map;
}

export function getMaterialQtyInWarehouse(
  stockMap: Map<string, Map<string, number>>,
  materialId: string,
  warehouseId: string
): number {
  const whMap = stockMap.get(materialId);
  return whMap?.get(warehouseId) || 0;
}

export function decomposeUnits(baseQty: number, units: MaterialUnitDto[]): { unit: MaterialUnitDto; qty: number }[] {
  const sorted = [...units].sort((a, b) => parseFloat(b.conversion_factor) - parseFloat(a.conversion_factor));
  let remaining = Math.max(0, baseQty);
  const result: { unit: MaterialUnitDto; qty: number }[] = [];
  for (const u of sorted) {
    const factor = parseFloat(u.conversion_factor);
    if (factor === 0) continue;
    const qty = Math.floor(remaining / factor);
    remaining = remaining - qty * factor;
    result.push({ unit: u, qty });
  }
  return result;
}

export function formatDecomposition(parts: { unit: MaterialUnitDto; qty: number }[]): string {
  const nonZero = parts.filter(p => p.qty > 0);
  if (nonZero.length === 0 && parts.length > 0) return `0 ${parts[parts.length - 1].unit.name}`;
  return nonZero.map((p, i) => {
    const isLast = i === nonZero.length - 1;
    return `${p.qty.toLocaleString()} ${p.unit.name}${isLast ? '' : '، '}`;
  }).join('و ');
}
