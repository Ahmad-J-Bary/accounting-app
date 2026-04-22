import { invoke } from '@/lib/invoke';
import type { AccountDto, AccountLedgerDto } from '@erp/shared-types';

export const accountingService = {
  async getChartOfAccounts(): Promise<AccountDto[]> {
    return await invoke<AccountDto[]>('get_chart_of_accounts');
  },

  async getAccountLedger(accountId: string): Promise<AccountLedgerDto> {
    return await invoke<AccountLedgerDto>('get_account_ledger', { accountId });
  },
};
