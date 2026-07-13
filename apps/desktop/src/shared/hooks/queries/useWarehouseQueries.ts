import { useQuery } from "@tanstack/react-query";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { WarehouseDto } from "@erp/shared-types";

export function useWarehouses() {
  return useQuery<WarehouseDto[]>({
    queryKey: QUERY_KEYS.warehouses,
    queryFn: () => warehouseService.list(),
  });
}
