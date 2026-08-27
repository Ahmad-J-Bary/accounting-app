import { useQuery } from "@tanstack/react-query";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { ProfitDistributionSource } from "@modules/accounting/api/openingBalanceService";
import type { DistributionPool } from "../lib/types";

interface UseDistributionPoolResult {
  pool: DistributionPool | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function useDistributionPool(
  source: ProfitDistributionSource | null,
  windowStart: string,
  windowEnd: string
): UseDistributionPoolResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.distributableProfit(windowStart, windowEnd),
    queryFn: () => fiscalPeriodService.getDistributableProfit(windowStart, windowEnd),
    enabled: !!source && !!windowStart && !!windowEnd,
  });

  if (!source || !data) {
    return { pool: null, isLoading, isError, error, refetch };
  }

  const pool: DistributionPool = {
    source,
    sourceLabel: "",
    retainedEarnings: parseSafeNumber(data.retained_earnings_balance ?? "0"),
    currentPeriodProfit: parseSafeNumber(data.current_period_profit ?? "0"),
    available: parseSafeNumber(data.distributable ?? "0"),
    allocatedToDate: parseSafeNumber(data.allocated_to_date ?? "0"),
  };

  return { pool, isLoading, isError, error, refetch };
}
