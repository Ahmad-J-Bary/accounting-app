import { invoke } from '@shared/lib/invoke';

export type OpeningMigrationStatus = 'Draft' | 'Posted' | 'Cancelled';

export interface OpeningBalanceLineDto {
  account_id: string;
  amount: string;
  description: string | null;
}

export interface OpeningBalanceMigrationDto {
  id: string;
  cutover_date: string;
  status: OpeningMigrationStatus;
  notes: string | null;
  lines: OpeningBalanceLineDto[];
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostOpeningBalanceResult {
  migration: OpeningBalanceMigrationDto;
  debit_total: string;
  credit_total: string;
  equity_balanced: boolean;
}

export interface OpeningLineInput {
  account_id: string;
  amount: string;
  description?: string | null;
}

export interface CreateOpeningBalanceMigrationRequest {
  cutover_date: string;
  notes?: string | null;
  lines: OpeningLineInput[];
}

export interface PartnerAllocationShare {
  partner_id: string;
  partner_name: string;
  capital: string;
  ratio_percent: string;
  share: string;
}

export interface NetProfitAllocationDto {
  entry_number: string;
  net_profit: string;
  allocated_total: string;
  shares: PartnerAllocationShare[];
}

export interface AllocateNetProfitRequest {
  migration_id: string;
  net_profit: string;
}

export const openingBalanceService = {
  async createMigration(request: CreateOpeningBalanceMigrationRequest): Promise<OpeningBalanceMigrationDto> {
    return await invoke<OpeningBalanceMigrationDto>('create_opening_balance_migration', { request });
  },
  async listMigrations(): Promise<OpeningBalanceMigrationDto[]> {
    return await invoke<OpeningBalanceMigrationDto[]>('list_opening_balance_migrations', {});
  },
  async postMigration(id: string): Promise<PostOpeningBalanceResult> {
    return await invoke<PostOpeningBalanceResult>('post_opening_balance_migration', { id });
  },
  async allocateNetProfit(request: AllocateNetProfitRequest): Promise<NetProfitAllocationDto> {
    return await invoke<NetProfitAllocationDto>('allocate_net_profit', { request });
  },
};