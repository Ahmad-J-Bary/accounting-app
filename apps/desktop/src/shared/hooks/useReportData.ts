import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ReportConfig, ReportState } from "@shared/types/report";

export function useReportData<TData, TFilters extends { from_date: string; to_date: string } = { from_date: string; to_date: string }>(
  config: ReportConfig<TData, TFilters>
): ReportState<TData> {
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const fetchReportData = useCallback(
    async (filters: TFilters): Promise<TData> => {
      let data: TData = await config.fetchData(filters);
      if (config.computeData) {
        data = config.computeData(data, filters);
      }
      return data;
    },
    [config]
  );

  const { data: reportData, isLoading, isFetching, refetch } = useQuery<TData>({
    queryKey: config.queryKey,
    queryFn: () => {
      let filters: TFilters | undefined = undefined;
      const objFilters = config.queryKey.find(
        (item) => typeof item === "object" && item !== null && "from_date" in item
      ) as TFilters | undefined;
      if (objFilters) {
        filters = objFilters;
      } else {
        const len = config.queryKey.length;
        const toDate = config.queryKey[len - 1];
        const fromDate = config.queryKey[len - 2];
        if (typeof fromDate === "string" && typeof toDate === "string" && fromDate.includes("-") && toDate.includes("-")) {
          filters = { from_date: fromDate, to_date: toDate } as unknown as TFilters;
        }
      }
      return fetchReportData(filters ?? {} as TFilters);
    },
    initialData: config.initialData ?? config.emptyData,
  });

  const loadReportData = useCallback(async () => {
    try {
      await refetch();
      hasLoadedOnceRef.current = true;
      setLastLoadedAt(new Date());
    } catch (error) {
      console.error(error);
      toast.error(config.errorMessage ?? "تعذر تحميل البيانات");
    }
  }, [config, refetch]);

  const refreshing = isFetching && hasLoadedOnceRef.current;
  const loading = isLoading && !hasLoadedOnceRef.current;

  return {
    loading,
    refreshing,
    lastLoadedAt,
    reportData: reportData ?? config.emptyData,
    loadReportData,
  };
}

export function createReportQueryKey<TFilters extends { from_date: string; to_date: string }>(
  baseKey: readonly unknown[],
  filters: TFilters
): readonly unknown[] {
  return [...baseKey, filters.from_date, filters.to_date] as const;
}