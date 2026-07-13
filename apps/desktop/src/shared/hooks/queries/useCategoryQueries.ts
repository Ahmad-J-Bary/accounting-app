import { useQuery } from "@tanstack/react-query";
import { categoryService } from "@modules/inventory/api/categoryService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { CategoryDto } from "@erp/shared-types";

export function useCategories() {
  return useQuery<CategoryDto[]>({
    queryKey: QUERY_KEYS.categories,
    queryFn: () => categoryService.list(),
  });
}
