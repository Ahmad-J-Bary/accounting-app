import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  JournalEntryDto,
  Payment,
  MaterialDto,
  CategoryDto,
  StockMovement,
} from "@erp/shared-types";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { paymentService } from "@modules/payments/api/paymentService";
import { materialService } from "@modules/inventory/api/materialService";
import { categoryService } from "@modules/inventory/api/categoryService";
import { stockMovementService } from "@modules/inventory/api/stockMovementService";
import {
  computeDashboardKpis,
  type DashboardKpis,
  type GlMonthlyIncome,
} from "@modules/accounting/dashboard/lib/gl-kpis";
import {
  computeInventoryProjection,
  inventoryAdjustmentNets,
} from "@modules/reports/lib/inventory";

export type DashboardPeriod = "today" | "this_month" | "this_year";

export function dashboardPeriodRange(period: DashboardPeriod): { fromTs: number; toTs: number } {
  const now = new Date();
  const toTs = Date.now();
  switch (period) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { fromTs: start.getTime(), toTs };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fromTs: start.getTime(), toTs };
    }
    case "this_year":
    default: {
      const start = new Date(now.getFullYear(), 0, 1);
      return { fromTs: start.getTime(), toTs };
    }
  }
}

export interface DashboardMetrics {
  kpis: DashboardKpis & { monthly: GlMonthlyIncome[] };
  inventory: number;
  journalEntries: JournalEntryDto[];
  payments: Payment[];
  materials: MaterialDto[];
  categories: CategoryDto[];
  stockMovements: StockMovement[];
}

export function useDashboardMetrics(period: DashboardPeriod): {
  data: DashboardMetrics;
  isLoading: boolean;
  refreshing: boolean;
} {
  const journalQuery = useQuery({
    queryKey: QUERY_KEYS.dashboard,
    queryFn: () => journalEntryService.listPostedJournalEntries(),
  });
  const paymentsQuery = useQuery({
    queryKey: QUERY_KEYS.payments,
    queryFn: () => paymentService.listPayments(),
  });
  const materialsQuery = useQuery({
    queryKey: QUERY_KEYS.materials,
    queryFn: () => materialService.list(),
  });
  const categoriesQuery = useQuery({
    queryKey: QUERY_KEYS.categories,
    queryFn: () => categoryService.list(),
  });
  const stockMovementsQuery = useQuery({
    queryKey: QUERY_KEYS.stockMovements,
    queryFn: () => stockMovementService.list(),
  });

  const range = useMemo(() => dashboardPeriodRange(period), [period]);

  const kpis = useMemo(
    () => computeDashboardKpis(journalQuery.data ?? [], range),
    [journalQuery.data, range.fromTs, range.toTs],
  );

  const inventory = useMemo(() => {
    const adjustments = inventoryAdjustmentNets(journalQuery.data ?? []);
    return computeInventoryProjection(
      stockMovementsQuery.data ?? [],
      { fromTs: 0, toTs: Date.now() },
      adjustments,
    ).closingInventory;
  }, [stockMovementsQuery.data, journalQuery.data]);

  return {
    data: {
      kpis,
      inventory,
      journalEntries: journalQuery.data ?? [],
      payments: paymentsQuery.data ?? [],
      materials: materialsQuery.data ?? [],
      categories: categoriesQuery.data ?? [],
      stockMovements: stockMovementsQuery.data ?? [],
    },
    isLoading:
      journalQuery.isLoading ||
      paymentsQuery.isLoading ||
      materialsQuery.isLoading ||
      categoriesQuery.isLoading ||
      stockMovementsQuery.isLoading,
    refreshing:
      journalQuery.isRefetching ||
      paymentsQuery.isRefetching ||
      materialsQuery.isRefetching ||
      categoriesQuery.isRefetching ||
      stockMovementsQuery.isRefetching,
  };
}