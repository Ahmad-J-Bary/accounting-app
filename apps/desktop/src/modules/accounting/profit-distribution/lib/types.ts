import type { ProfitDistributionSource } from "@modules/accounting/api/openingBalanceService";

export interface DistributionPool {
  source: ProfitDistributionSource;
  sourceLabel: string;
  retainedEarnings: number;
  currentPeriodProfit: number;
  available: number;
  allocatedToDate: number;
  currency?: string;
}
