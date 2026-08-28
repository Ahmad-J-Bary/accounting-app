import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportBaseData } from "@modules/reports/hooks/useReportBaseData";
import { usePartners } from "@shared/hooks/queries/usePartnerQueries";
import { useReceivablesPayables } from "@shared/hooks/queries/useReportQueries";
import { fixedAssetService } from "@modules/fixed-assets/api/fixedAssetService";
import { partnerService } from "@modules/partners/api/partnerService";
import { computeIncomeStatement } from "@modules/reports/lib/incomeStatement";
import { useMaterialExpenseLedgers } from "@shared/hooks/useMaterialExpenseLedgers";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { toUtcBound } from "@shared/lib/format";
import type { LoadedIncomeStatementData, IncomeStatementFilters } from "@modules/reports/lib/incomeStatement";
import type { PartnerProfitShareComputed, PartnerProfitShareRow } from "@modules/reports/lib/partnerProfitShare";
import type { PartnerStatementComputed, PartnerStatementRow } from "@modules/reports/lib/partnerStatement";
import type { ReportState } from "@shared/types/report";

export type PartnerRightsReportData = {
  profitShare: PartnerProfitShareComputed;
  statement: PartnerStatementComputed;
};

const emptyData: PartnerRightsReportData = {
  profitShare: { rows: [], totalCapital: 0, netProfit: 0, inventoryValue: 0, fixedAssetsValue: 0, totalCustomerDebts: 0, totalOperationalAssets: 0 },
  statement: { rows: [] },
};

export function usePartnerRightsReport(filters: IncomeStatementFilters): ReportState<PartnerRightsReportData> & { computed: PartnerRightsReportData } {
  const { data: baseData, isLoading: baseLoading, isError: baseError, isRefetching: baseRefetching, refetch: baseRefetch } = useReportBaseData(filters);

  const partnersQuery = usePartners();
  const receivablesQuery = useReceivablesPayables();
  const fixedAssetsQuery = useQuery({
    queryKey: QUERY_KEYS.fixedAssets,
    queryFn: () => fixedAssetService.list(),
  });

  const { loadMaterialExpenseLedgers } = useMaterialExpenseLedgers();

  const [resolvedData, setResolvedData] = useState<PartnerRightsReportData>(emptyData);
  const [loadingLedgers, setLoadingLedgers] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const isLoading = baseLoading || partnersQuery.isLoading || receivablesQuery.isLoading || fixedAssetsQuery.isLoading;
  const isError = baseError || partnersQuery.isError || receivablesQuery.isError || fixedAssetsQuery.isError;
  const isRefetching = baseRefetching || partnersQuery.isRefetching || receivablesQuery.isRefetching || fixedAssetsQuery.isRefetching;

  useEffect(() => {
    if (isLoading || isError) return;

    let active = true;
    const run = async () => {
      setLoadingLedgers(true);
      try {
        const stockMovementsByMaterial = await loadMaterialExpenseLedgers(
          baseData.materials
        );
        if (!active) return;

        const incomeStatementData: LoadedIncomeStatementData = {
          salesInvoices: baseData.salesInvoices,
          purchaseInvoices: baseData.purchaseInvoices,
          purchaseReturns: baseData.purchaseReturns,
          salesReturns: baseData.salesReturns,
          stockMovementsByMaterial,
          materials: baseData.materials,
          accounts: baseData.accounts,
          entries: baseData.entries,
        };

        const incomeStatementResult = computeIncomeStatement(filters, incomeStatementData);

        const receivables = receivablesQuery.data;
        const fixedAssets = fixedAssetsQuery.data ?? [];

        const customerDebts = parseFloat(receivables?.customers_debit || "0");
        const toDateStr = filters.to_date.split("T")[0];
        const fixedAssetsValue = fixedAssets
          .filter((asset) => asset.status === "Active" && (asset.purchase_date?.split("T")[0] ?? "") <= toDateStr)
          .reduce((sum, asset) => {
            const purchaseCost = parseFloat(asset.purchase_cost?.amount ?? "0");
            const accumulated = parseFloat(asset.accumulated_depreciation?.amount ?? "0");
            return sum + (purchaseCost - accumulated);
          }, 0);

        // Fetch the equity statement from the backend with date params
        const fromIso = toUtcBound(filters.from_date, false);
        const toIso = toUtcBound(filters.to_date, true);
        const equityStatement = await partnerService.getPartnerEquityStatement(fromIso, toIso);

        // Map backend rows to PartnerProfitShareRow
        const inventoryValue = incomeStatementResult.closingInventory;
        const totalOperationalAssets = inventoryValue + fixedAssetsValue + customerDebts;

        const profitShareRows: PartnerProfitShareRow[] = equityStatement.rows.map((r) => {
          const capitalAmount = parseFloat(r.capital_registered);
          const capitalRatio = parseFloat(r.capital_ratio);
          const profitShareRatio = parseFloat(r.profit_share_ratio);
          const profitShareAmount = incomeStatementResult.netProfit * (profitShareRatio / 100);
          const drawings = parseFloat(r.drawings);
          const finalAmount = capitalAmount + profitShareAmount - drawings;
          const inventoryShare = inventoryValue * (profitShareRatio / 100);
          const fixedAssetsShare = fixedAssetsValue * (profitShareRatio / 100);
          const operationalAssetShare = totalOperationalAssets * (profitShareRatio / 100);

          return {
            partnerId: r.partner_id,
            partnerName: r.partner_name,
            capitalRatio,
            capitalAmount,
            profitShareRatio,
            profitShareAmount,
            drawings,
            finalAmount,
            inventoryShare,
            fixedAssetsShare,
            operationalAssetShare,
          };
        });

        const profitShare: PartnerProfitShareComputed = {
          totalCapital: parseFloat(equityStatement.total_capital),
          netProfit: incomeStatementResult.netProfit,
          inventoryValue,
          fixedAssetsValue,
          totalOperationalAssets,
          totalCustomerDebts: customerDebts,
          rows: profitShareRows,
        };

        // Map backend rows to PartnerStatementRow
        const statementRows: PartnerStatementRow[] = equityStatement.rows.map((r) => {
          const capitalAmount = parseFloat(r.capital_registered);
          const accumulatedProfits = parseFloat(r.accumulated_profit_prior);
          const accumulatedDrawings = parseFloat(r.accumulated_drawings_prior);
          const currentAccount = capitalAmount + accumulatedProfits - accumulatedDrawings;
          const thisYearProfit = parseFloat(r.period_profit);
          const thisYearDrawings = parseFloat(r.period_drawings);
          const finalAmount = currentAccount + thisYearProfit - thisYearDrawings;

          return {
            partnerId: r.partner_id,
            partnerName: r.partner_name,
            capitalAmount,
            accumulatedProfits,
            accumulatedDrawings,
            currentAccount,
            thisYearProfit,
            thisYearDrawings,
            finalAmount,
          };
        });

        const statement: PartnerStatementComputed = { rows: statementRows };

        if (active) {
          setResolvedData({ profitShare, statement });
          setLastLoadedAt(new Date());
        }
      } catch (e) {
        console.error("Failed to load partner report data:", e);
      } finally {
        if (active) setLoadingLedgers(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [
    baseData,
    isLoading,
    isError,
    filters,
    loadMaterialExpenseLedgers,
    partnersQuery.data,
    receivablesQuery.data,
    fixedAssetsQuery.data,
  ]);

  return {
    loading: isLoading || loadingLedgers,
    refreshing: isRefetching,
    lastLoadedAt,
    reportData: resolvedData,
    error: isError,
    loadReportData: async () => {
      await Promise.all([
        baseRefetch(),
        partnersQuery.refetch(),
        receivablesQuery.refetch(),
        fixedAssetsQuery.refetch(),
      ]);
    },
    computed: resolvedData,
  };
}
