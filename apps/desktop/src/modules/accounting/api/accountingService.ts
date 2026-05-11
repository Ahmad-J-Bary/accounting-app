import { invoke } from '@shared/lib/invoke';
import type { AccountDto, AccountLedgerDto, ReceivablesPayablesSummary, SaveAccountCommand } from "@erp/shared-types";

export type AccountType =
  | "Assets"
  | "Liabilities"
  | "Equity"
  | "Revenue"
  | "Expenses";
export type AccountCategory = "Summary" | "Detail";

export const accountingService = {
  async getChartOfAccounts(): Promise<AccountDto[]> {
    return await invoke<AccountDto[]>("get_chart_of_accounts");
  },

  async getAccountLedger(accountId: string): Promise<AccountLedgerDto> {
    return await invoke<AccountLedgerDto>("get_account_ledger", { accountId });
  },

  async createAccount(cmd: SaveAccountCommand): Promise<AccountDto> {
    return await invoke<AccountDto>("create_account", { cmd });
  },

  async updateAccount(
    id: string,
    cmd: SaveAccountCommand,
  ): Promise<AccountDto> {
    return await invoke<AccountDto>("update_account", { id, cmd });
  },

  async deleteAccount(id: string): Promise<void> {
    return await invoke<void>("delete_account", { id });
  },

  async activateAccount(id: string): Promise<AccountDto> {
    return await invoke<AccountDto>("activate_account", { id });
  },

  async deactivateAccount(id: string): Promise<AccountDto> {
    return await invoke<AccountDto>("deactivate_account", { id });
  },

  async getExpenseItems(): Promise<AccountDto[]> {
    return await invoke<AccountDto[]>("get_expense_items");
  },

  async getReceivablesPayablesSummary(): Promise<ReceivablesPayablesSummary> {
    return await invoke<ReceivablesPayablesSummary>("get_receivables_payables_summary");
  },
};
