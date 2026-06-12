import type { MaterialUnitDto } from "@erp/shared-types";

interface StockMovementLike {
  warehouse_id?: string | null;
  material_id: string;
  quantity: string;
  is_inflow?: boolean;
}

export function buildStockByWarehouse(
  movements: StockMovementLike[]
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const m of movements) {
    if (!m.warehouse_id) continue;
    const mid = m.material_id;
    const wid = m.warehouse_id;
    const qty = parseFloat(m.quantity || "0");
    const isInflow = m.is_inflow ?? (qty >= 0);
    let mat = map.get(mid);
    if (!mat) {
      mat = new Map();
      map.set(mid, mat);
    }
    mat.set(wid, (mat.get(wid) || 0) + (isInflow ? qty : -qty));
  }
  return map;
}

export interface UnitPart {
  unitName: string;
  quantity: number;
  isBase: boolean;
}

export function decomposeUnits(
  totalBaseQty: number,
  units: MaterialUnitDto[]
): UnitPart[] {
  if (!units.length || totalBaseQty <= 0) return [];
  const sorted = [...units].sort(
    (a, b) => parseFloat(b.conversion_factor) - parseFloat(a.conversion_factor)
  );
  const parts: UnitPart[] = [];
  let remaining = totalBaseQty;
  for (const u of sorted) {
    const factor = parseFloat(u.conversion_factor);
    if (factor <= 0) continue;
    const qty = Math.floor(remaining / factor);
    if (qty > 0) {
      parts.push({ unitName: u.name, quantity: qty, isBase: u.is_base });
      remaining -= qty * factor;
    }
  }
  if (remaining > 0) {
    const baseUnit = units.find(u => u.is_base) || units[0];
    const existing = parts.find(p => p.unitName === baseUnit.name);
    if (existing) {
      existing.quantity += remaining;
    } else {
      parts.push({ unitName: baseUnit.name, quantity: remaining, isBase: true });
    }
  }
  return parts;
}

export function formatDecomposition(parts: UnitPart[]): string {
  return parts.map(p => `${p.quantity} ${p.unitName}`).join(" ");
}

export function getWarehouseStock(
  stockByWarehouse: Map<string, Map<string, number>>,
  materialId: string,
  warehouseId: string
): number {
  return stockByWarehouse.get(materialId)?.get(warehouseId) || 0;
}
