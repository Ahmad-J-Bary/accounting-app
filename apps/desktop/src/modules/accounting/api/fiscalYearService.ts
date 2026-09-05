import { invoke } from '@shared/lib/invoke';
import type {
  CloseFiscalYearCommand,
  CreateFiscalYearCommand,
  FiscalYearDto,
  ReopenFiscalYearCommand,
} from '@erp/shared-types';

export const fiscalYearService = {
  createFiscalYear: (request: CreateFiscalYearCommand) =>
    invoke<FiscalYearDto>('create_fiscal_year', { request }),
  listFiscalYears: () => invoke<FiscalYearDto[]>('list_fiscal_years', {}),
  closeFiscalYear: (request: CloseFiscalYearCommand) =>
    invoke<FiscalYearDto>('close_fiscal_year', { request }),
  reopenFiscalYear: (request: ReopenFiscalYearCommand) =>
    invoke<FiscalYearDto>('reopen_fiscal_year', { request }),
};
