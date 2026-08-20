import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { materialService } from "@modules/inventory/api/materialService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { MaterialDto, StockMovementDetailDto } from "@erp/shared-types";

/**
 * Fetches stock movements for all materials. Used by the report hooks to build
 * the shared inventory projection (opening + periodic closing, the same
 * valuation the Dashboard consumes).
 *
 * Each material's movements are cached under
 * `QUERY_KEYS.materialExpenseLedger(id)` so that inventory invalidations
 * (`["materials"]` prefix) make them stale and the next report computation
 * refetches — instead of the previous uncached N+1 that could not be
 * invalidated. Fresh cached ledgers are reused without an IPC round-trip.
 *
 * Expense ledgers are intentionally NOT fetched from per-account ledgers here:
 * operating expenses are aggregated from the enriched posted-ledger feed (each
 * line carries `account_type`/`account_purpose`), so there is no per-account
 * N+1 call and no stale-ledger window.
 */
export function useMaterialExpenseLedgers() {
  const qc = useQueryClient();

  const load = useCallback(
    async (materials: MaterialDto[]): Promise<Map<string, StockMovementDetailDto[]>> => {
      const movementResults = await Promise.allSettled(
        materials.map(async (material) => ({
          materialId: material.id,
          movements: await qc.fetchQuery({
            queryKey: QUERY_KEYS.materialExpenseLedger(material.id),
            queryFn: () => materialService.listMovementsByMaterial(material.id),
            staleTime: 30_000,
          }),
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
    [qc],
  );

  return { loadMaterialExpenseLedgers: load };
}