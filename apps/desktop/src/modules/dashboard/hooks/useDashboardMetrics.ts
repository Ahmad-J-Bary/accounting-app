import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  JournalEntryDto,
  Payment,
  MaterialDto,
  CategoryDto,
  StockMovement,
} from "@erp/shared-types";
import { invoke } from "@shared/lib/invoke";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { paymentService } from "@modules/payments/api/paymentService";
import { materialService } from "@modules/inventory/api/materialService";
import { categoryService } from "@modules/inventory/api/categoryService";
import { stockMovementService } from "@modules/inventory/api/stockMovementService";
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

/** ISO-8601 date bounds for the selected Dashboard period. */
function dashboardPeriodDates(period: DashboardPeriod): { fromDate: string; toDate: string } {
  const now = new Date();
  const toDate = now.toISOString().slice(0, 10);
  switch (period) {
    case "today":
      return { fromDate: toDate, toDate };
    case "this_month": {
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      return { fromDate: `${now.getFullYear()}-${mm}-01`, toDate };
    }
    case "this_year":
    default:
      return { fromDate: `${now.getFullYear()}-01-01`, toDate };
  }
}

interface DashboardKpiBackendResponse {
  kpis: Record<string, string>;
  monthly: Array<{ year_month: string; revenue: number; expenses: number }>;
}

export interface DashboardMetrics {
  kpis: {
    sales: number;
    purchases: number;
    cash: number;
    bank: number;
    receivables: number;
    payables: number;
    loans: number;
    monthly: Array<{ yearMonth: string; revenue: number; expenses: number }>;
  };
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
  const { fromDate, toDate } = useMemo(() => dashboardPeriodDates(period), [period]);

  const dashboardKpiQuery = useQuery({
    queryKey: [...QUERY_KEYS.dashboard, "kpis", fromDate, toDate],
    queryFn: () =>
      invoke<DashboardKpiBackendResponse>("compute_dashboard_kpis", {
        fromDate,
        toDate,
      }),
  });

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

  const kpis = useMemo(() => {
    const backend = dashboardKpiQuery.data;
    if (!backend) {
      return {
        sales: 0, purchases: 0, cash: 0, bank: 0,
        receivables: 0, payables: 0, loans: 0,
        monthly: [],
      };
    }

    const purposeNets = backend.kpis;
    const cash = parseFloat(purposeNets["general"] ?? "0") || 0;
    const bank = parseFloat(purposeNets["bank"] ?? "0") || 0;
    const receivables = Math.abs(parseFloat(purposeNets["receivable"] ?? "0") || 0);
    const payables = Math.abs(parseFloat(purposeNets["payable"] ?? "0") || 0);
    const loans = Math.abs(parseFloat(purposeNets["loan"] ?? "0") || 0);

    const sales = backend.monthly.reduce((sum, m) => sum + m.revenue, 0);
    const purchases = backend.monthly.reduce((sum, m) => sum + m.expenses, 0);

    const monthly = backend.monthly.map(m => ({
      yearMonth: m.year_month,
      revenue: m.revenue,
      expenses: m.expenses,
    }));

    return { sales, purchases, cash, bank, receivables, payables, loans, monthly };
  }, [dashboardKpiQuery.data]);

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
      dashboardKpiQuery.isLoading ||
      journalQuery.isLoading ||
      paymentsQuery.isLoading ||
      materialsQuery.isLoading ||
      categoriesQuery.isLoading ||
      stockMovementsQuery.isLoading,
    refreshing:
      dashboardKpiQuery.isRefetching ||
      journalQuery.isRefetching ||
      paymentsQuery.isRefetching ||
      materialsQuery.isRefetching ||
      categoriesQuery.isRefetching ||
      stockMovementsQuery.isRefetching,
  };
}