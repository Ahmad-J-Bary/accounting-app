import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { openingBalanceService, type OpeningBalanceMigrationDto, type ProfitDistributionSource } from "@modules/accounting/api/openingBalanceService";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { normalizeToUtcIso } from "@shared/lib/dateUtils";
import type { FiscalPeriodDto } from "@erp/shared-types";

interface DistributionSourceResult {
  source: ProfitDistributionSource | null;
  sourceLabel: string;
  windowStart: string;
  windowEnd: string;
  isLoading: boolean;
}

/**
 * Auto-detects the correct profit distribution source:
 * 1. Posted/Locked OpeningMigration → use it
 * 2. Active FiscalPeriod → use it
 * 3. Otherwise → null
 */
export function useDistributionSource(): DistributionSourceResult {
  const { data: migrations = [], isLoading: migrationsLoading } = useQuery<OpeningBalanceMigrationDto[]>({
    queryKey: ["opening-balance-migrations"],
    queryFn: () => openingBalanceService.listMigrations(),
  });

  const { data: periods = [], isLoading: periodsLoading } = useQuery<FiscalPeriodDto[]>({
    queryKey: QUERY_KEYS.fiscalPeriods,
    queryFn: () => fiscalPeriodService.listFiscalPeriods(),
  });

  const result = useMemo(() => {
    const latestMigration = [...migrations]
      .filter((m) => m.status === "Posted" || m.status === "Locked")
      .sort((a, b) => b.cutover_date.localeCompare(a.cutover_date))[0];

    if (latestMigration) {
      return {
        source: { OpeningMigration: { migration_id: latestMigration.id } } as const,
        sourceLabel: `ترحيل الرصيد الافتتاحي — ${latestMigration.cutover_date}`,
        windowStart: "1970-01-01T00:00:00Z",
        windowEnd: normalizeToUtcIso(latestMigration.cutover_date, true),
        isLoading: false,
      };
    }

    const activePeriod = periods
      .filter((p) => p.status === "Closed" || p.status === "Locked")
      .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];

    if (activePeriod) {
      return {
        source: { ClosedPeriod: { period_id: activePeriod.id } } as const,
        sourceLabel: `الفترة المالية — ${activePeriod.start_date} إلى ${activePeriod.end_date}`,
        windowStart: normalizeToUtcIso(activePeriod.start_date, false),
        windowEnd: normalizeToUtcIso(activePeriod.end_date, true),
        isLoading: false,
      };
    }

    return {
      source: null,
      sourceLabel: "",
      windowStart: "",
      windowEnd: "",
      isLoading: false,
    };
  }, [migrations, periods]);

  return {
    ...result,
    isLoading: migrationsLoading || periodsLoading,
  };
}
