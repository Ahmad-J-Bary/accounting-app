import { useQuery } from "@tanstack/react-query";
import { materialService } from "@modules/inventory/api/materialService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { MaterialDto, StockMovementDetailDto } from "@erp/shared-types";

export function useMaterials() {
  return useQuery<MaterialDto[]>({
    queryKey: QUERY_KEYS.materials,
    queryFn: () => materialService.list(),
  });
}

export function useMaterialMovements(materialId: string | undefined) {
  return useQuery<StockMovementDetailDto[]>({
    queryKey: QUERY_KEYS.materialMovements(materialId ?? ""),
    queryFn: () => materialService.listMovementsByMaterial(materialId!),
    enabled: !!materialId,
  });
}

export function useMaterialsStock() {
  return useQuery({
    queryKey: ["materials-stock"],
    queryFn: async () => {
      const materials = await materialService.list();
      const results = await Promise.allSettled(
        materials.map(async (m: MaterialDto) => ({
          materialId: m.id,
          movements: await materialService.listMovementsByMaterial(m.id),
        }))
      );
      const stockByMaterial = new Map<string, StockMovementDetailDto[]>();
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          stockByMaterial.set(r.value.materialId, r.value.movements ?? []);
        }
      });
      return stockByMaterial;
    },
  });
}
