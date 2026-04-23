import { invoke } from "@/lib/invoke";
import type { AccountDto, AccountLedgerDto } from "@erp/shared-types";

export type AccountType =
  | "Assets"
  | "Liabilities"
  | "Equity"
  | "Revenue"
  | "Expenses";
export type AccountCategory = "Summary" | "Detail";

export interface SaveAccountCommand {
  code: string;
  name_ar: string;
  name_en: string;
  account_type: AccountType;
  parent_id: string | null;
  category: AccountCategory;
  level: number;
  opening_balance: string;
  notes: string | null;
  is_default?: boolean;
  is_active?: boolean;
}

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
};
