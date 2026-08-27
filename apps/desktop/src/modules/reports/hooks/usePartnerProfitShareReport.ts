import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportBaseData } from "@modules/reports/hooks/useReportBaseData";
import { usePartners } from "@shared/hooks/queries/usePartnerQueries";
import { useReceivablesPayables } from "@shared/hooks/queries/useReportQueries";
import { fixedAssetService } from "@modules/fixed-assets/api/fixedAssetService";
import { accountingService } from "@modules/accounting/api/accountingService";
import { computeIncomeStatement } from "@modules/reports/lib/incomeStatement";
import { useMaterialExpenseLedgers } from "@shared/hooks/useMaterialExpenseLedgers";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { LoadedIncomeStatementData, IncomeStatementFilters } from "@modules/reports/lib/incomeStatement";
import type { PartnerDto, AccountLedgerDto } from "@erp/shared-types";
import type { ReportState } from "@shared/types/report";

export type LoadedPartnerProfitShareData = {
  partners: PartnerDto[];
  netProfit: number;
  inventoryValue: number;
  fixedAssetsValue: number;
  partnerDrawings: Record<string, number>;
  customerDebts: number;
  partnerLedgers: Record<string, AccountLedgerDto>;
};

const emptyData: LoadedPartnerProfitShareData = {
  partners: [],
  netProfit: 0,
  inventoryValue: 0,
  fixedAssetsValue: 0,
  partnerDrawings: {},
  customerDebts: 0,
  partnerLedgers: {},
};

export function usePartnerProfitShareReport(filters: IncomeStatementFilters): ReportState<LoadedPartnerProfitShareData> {
  const { data: baseData, isLoading: baseLoading, isError: baseError, isRefetching: baseRefetching, refetch: baseRefetch } = useReportBaseData(filters);

  const partnersQuery = usePartners();
  const receivablesQuery = useReceivablesPayables();
  const fixedAssetsQuery = useQuery({
    queryKey: QUERY_KEYS.fixedAssets,
    queryFn: () => fixedAssetService.list(),
  });

  const { loadMaterialExpenseLedgers } = useMaterialExpenseLedgers();

  const [resolvedData, setResolvedData] = useState<LoadedPartnerProfitShareData>(emptyData);
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

        const partners = partnersQuery.data ?? [];
        const entries = baseData.entries;
        const receivables = receivablesQuery.data;
        const fixedAssets = fixedAssetsQuery.data ?? [];

        const partnerDrawings: Record<string, number> = {};
        const drawingsAccountMap: Record<string, string> = {};
        for (const p of partners) {
          if (p.drawings_account_id) {
            drawingsAccountMap[p.drawings_account_id] = p.id;
            partnerDrawings[p.id] = 0;
          }
        }

        for (const entry of entries) {
          for (const line of entry.lines) {
            const pId = drawingsAccountMap[line.account_id];
            if (pId) {
              const debit = parseFloat(line.debit_base || line.debit || "0");
              const credit = parseFloat(line.credit_base || line.credit || "0");
              const net = debit - credit;
              if (net > 0) {
                partnerDrawings[pId] = (partnerDrawings[pId] || 0) + net;
              }
            }
          }
        }

        const customerDebts = parseFloat(receivables?.customers_debit || "0");
        const toDateStr = filters.to_date.split("T")[0];
        const fixedAssetsValue = fixedAssets
          .filter((asset) => asset.status === "Active" && (asset.purchase_date?.split("T")[0] ?? "") <= toDateStr)
          .reduce((sum, asset) => {
            const purchaseCost = parseFloat(asset.purchase_cost?.amount ?? "0");
            const accumulated = parseFloat(asset.accumulated_depreciation?.amount ?? "0");
            return sum + (purchaseCost - accumulated);
          }, 0);

        const partnerLedgers: Record<string, AccountLedgerDto> = {};
        await Promise.allSettled(
          partners.map(async (p) => {
            // Capital, drawings, and the current (profit) account: the current
            // account carries accumulated profit allocations and is the only
            // ledger-backed source for "accumulated profits" (Sec 4 / Sec 13) —
            // never derived as credits−registered capital.
            const accountIds = [p.linked_account_id, p.drawings_account_id, p.current_account_id].filter(Boolean) as string[];
            const ledgers = await Promise.allSettled(
              accountIds.map((id) => accountingService.getAccountLedger([id]))
            );
            ledgers.forEach((result, i) => {
              if (result.status === "fulfilled") {
                partnerLedgers[accountIds[i]] = result.value;
              }
            });
          })
        );

        if (active) {
          setResolvedData({
            partners,
            netProfit: incomeStatementResult.netProfit,
            inventoryValue: incomeStatementResult.closingInventory,
            fixedAssetsValue,
            partnerDrawings,
            customerDebts,
            partnerLedgers,
          });
          setLastLoadedAt(new Date());
        }
      } catch (e) {
        console.error("Failed to load partner profit share report calculations:", e);
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
  };
}
