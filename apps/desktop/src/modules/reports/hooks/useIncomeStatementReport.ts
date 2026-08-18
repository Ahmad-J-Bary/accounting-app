import { useEffect, useState } from "react";
import { useReportBaseData } from "@modules/reports/hooks/useReportBaseData";
import { useMaterialExpenseLedgers } from "@shared/hooks/useMaterialExpenseLedgers";
import { emptyIncomeStatementData } from "@modules/reports/lib/incomeStatement";
import type { LoadedIncomeStatementData } from "@modules/reports/lib/incomeStatement";
import type { ReportState } from "@shared/types/report";

export function useIncomeStatementReport(): ReportState<LoadedIncomeStatementData> {
  const { data: baseData, isLoading, isError, isRefetching, refetch } = useReportBaseData();
  const { loadMaterialExpenseLedgers } = useMaterialExpenseLedgers();

  const [resolvedData, setResolvedData] = useState<LoadedIncomeStatementData>(emptyIncomeStatementData);
  const [loadingLedgers, setLoadingLedgers] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (isLoading || isError) return;

    let active = true;
    const run = async () => {
      setLoadingLedgers(true);
      try {
        const stockMovementsByMaterial = await loadMaterialExpenseLedgers(baseData.materials);
        if (active) {
          setResolvedData({
            ...baseData,
            stockMovementsByMaterial,
          });
          setLastLoadedAt(new Date());
        }
      } catch (e) {
        console.error("Failed to load material expense ledgers:", e);
      } finally {
        if (active) setLoadingLedgers(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [baseData, isLoading, isError, loadMaterialExpenseLedgers]);

  return {
    loading: isLoading || loadingLedgers,
    refreshing: isRefetching,
    lastLoadedAt,
    reportData: resolvedData,
    loadReportData: refetch,
  };
}