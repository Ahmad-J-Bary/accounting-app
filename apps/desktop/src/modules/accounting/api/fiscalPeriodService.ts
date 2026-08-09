import { invoke } from '@shared/lib/invoke';
import type {
  CloseFiscalPeriodCommand,
  ComputePeriodProfitCommand,
  ComputedPeriodProfitDto,
  CreateFiscalPeriodCommand,
  DistributableProfitDto,
  FiscalPeriodDto,
} from '@erp/shared-types';

export const fiscalPeriodService = {
  createFiscalPeriod: (request: CreateFiscalPeriodCommand) =>
    invoke<FiscalPeriodDto>('create_fiscal_period', { request }),
  listFiscalPeriods: () => invoke<FiscalPeriodDto[]>('list_fiscal_periods', {}),
  closeFiscalPeriod: (request: CloseFiscalPeriodCommand) =>
    invoke<FiscalPeriodDto>('close_fiscal_period', { request }),
  computePeriodNetProfit: (request: ComputePeriodProfitCommand) =>
    invoke<ComputedPeriodProfitDto>('compute_period_net_profit', { request }),
  getDistributableProfit: (periodStart: string, periodEnd: string) =>
    invoke<DistributableProfitDto>('get_distributable_profit', {
      periodStart,
      periodEnd,
    }),
};