import { useCallback } from "react";
import { materialService } from "@modules/inventory/api/materialService";
import type { MaterialDto, StockMovementDetailDto } from "@erp/shared-types";

/**
 * Fetches stock movements for all materials. Used by the report hooks to build
 * the shared inventory projection (opening + periodic closing, the same
 * valuation the Dashboard consumes).
 *
 * Expense ledgers are intentionally NOT fetched here anymore: operating
 * expenses are aggregated from the enriched posted-ledger feed (each line
 * carries `account_type`/`account_purpose`), so there is no per-account N+1
 * call and no stale-ledger window.
 */
export function useMaterialExpenseLedgers() {
  const load = useCallback(
    async (materials: MaterialDto[]): Promise<Map<string, StockMovementDetailDto[]>> => {
      const movementResults = await Promise.allSettled(
        materials.map(async (material) => ({
          materialId: material.id,
          movements: await materialService.listMovementsByMaterial(material.id),
        })),
      );

      const stockMovementsByMaterial = new Map<string, StockMovementDetailDto[]>();
      movementResults.forEach((result) => {
        if (result.status === "fulfilled") {
          stockMovementsByMaterial.set(result.value.materialId, result.value.movements ?? []);
        }
      });

      return stockMovementsByMaterial;
    },
    [],
  );

  return { loadMaterialExpenseLedgers: load };
}