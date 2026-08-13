import { invoke } from '@shared/lib/invoke';
import type {
  CloseFiscalPeriodCommand,
  ComputePeriodProfitCommand,
  ComputedPeriodProfitDto,
  CreateFiscalPeriodCommand,
  DistributableProfitDto,
  FiscalPeriodDto,
  LockFiscalPeriodCommand,
  ReopenFiscalPeriodCommand,
} from '@erp/shared-types';

export const fiscalPeriodService = {
  createFiscalPeriod: (request: CreateFiscalPeriodCommand) =>
    invoke<FiscalPeriodDto>('create_fiscal_period', { request }),
  listFiscalPeriods: () => invoke<FiscalPeriodDto[]>('list_fiscal_periods', {}),
  closeFiscalPeriod: (request: CloseFiscalPeriodCommand) =>
    invoke<FiscalPeriodDto>('close_fiscal_period', { request }),
  lockFiscalPeriod: (request: LockFiscalPeriodCommand) =>
    invoke<FiscalPeriodDto>('lock_fiscal_period', { request }),
  reopenFiscalPeriod: (request: ReopenFiscalPeriodCommand) =>
    invoke<FiscalPeriodDto>('reopen_fiscal_period', { request }),
  computePeriodNetProfit: (request: ComputePeriodProfitCommand) =>
    invoke<ComputedPeriodProfitDto>('compute_period_net_profit', { request }),
  getDistributableProfit: (periodStart: string, periodEnd: string) =>
    invoke<DistributableProfitDto>('get_distributable_profit', {
      periodStart,
      periodEnd,
    }),
};

/**
 * Normalizes a date-only input to the exact window instants the period uses:
 * start at 00:00:00Z and end at the LAST instant of the day (23:59:59Z) so the
 * whole end-day is inside the period window.
 */
export function periodWindowFromDateInput(start: string, end: string): { start_date: string; end_date: string } {
  const startUtc = new Date(`${start}T00:00:00Z`);
  const endUtc = new Date(`${end}T23:59:59Z`);
  return {
    start_date: startUtc.toISOString(),
    end_date: endUtc.toISOString(),
  };
}