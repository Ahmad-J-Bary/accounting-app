import { useLocalization } from "@app/providers/LocalizationProvider";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { openingBalanceService, type OpeningBalanceMigrationDto, type ProfitDistributionSource } from "@modules/accounting/api/openingBalanceService";
import { normalizeToUtcIso } from "@shared/lib/dateUtils";

interface DistributionSourceResult {
  source: ProfitDistributionSource | null;
  sourceLabel: string;
  windowStart: string;
  windowEnd: string;
  isLoading: boolean;
}

/**
 * Auto-detects the correct profit distribution source:
 * Posted/Locked OpeningMigration → use it; otherwise null.
 */
export function useDistributionSource(): DistributionSourceResult {
  const { t } = useLocalization();
  const { data: migrations = [], isLoading: migrationsLoading } = useQuery<OpeningBalanceMigrationDto[]>({
    queryKey: ["opening-balance-migrations"],
    queryFn: () => openingBalanceService.listMigrations(),
  });

  const result = useMemo(() => {
    const latestMigration = [...migrations]
      .filter((m) => m.status === "Posted" || m.status === "Locked")
      .sort((a, b) => b.cutover_date.localeCompare(a.cutover_date))[0];

    if (latestMigration) {
      return {
        source: { OpeningMigration: { migration_id: latestMigration.id } } as const,
        sourceLabel: t("profitDistribution.sourceLabelMigration", {
          namespace: "accounting",
          vars: { date: latestMigration.cutover_date },
          }),
        windowStart: "1970-01-01T00:00:00Z",
        windowEnd: normalizeToUtcIso(latestMigration.cutover_date, true),
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
  }, [migrations, t]);

  return {
    ...result,
    isLoading: migrationsLoading,
  };
}
