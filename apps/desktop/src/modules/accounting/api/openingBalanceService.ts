import { invoke } from '@shared/lib/invoke';

export type OpeningMigrationStatus =
  | 'Draft'
  | 'Validated'
  | 'Approved'
  | 'Posted'
  | 'Locked'
  | 'Cancelled';

export interface OpeningBalanceLineDto {
  account_id: string;
  amount: string;
  description: string | null;
}

export interface OpeningBalanceMigrationDto {
  id: string;
  company_id: string | null;
  cutover_date: string;
  source_system: string | null;
  source_reference: string | null;
  status: OpeningMigrationStatus;
  notes: string | null;
  lines: OpeningBalanceLineDto[];
  validated_by: string | null;
  validated_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_at: string | null;
  locked_at: string | null;
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
  async cancelMigration(id: string): Promise<OpeningBalanceMigrationDto> {
    return await invoke<OpeningBalanceMigrationDto>('cancel_opening_balance_migration', { id });
  },
  async validateMigration(id: string, by: string): Promise<OpeningBalanceMigrationDto> {
    return await invoke<OpeningBalanceMigrationDto>('validate_opening_balance_migration', { id, by });
  },
  async approveMigration(id: string, by: string): Promise<OpeningBalanceMigrationDto> {
    return await invoke<OpeningBalanceMigrationDto>('approve_opening_balance_migration', { id, by });
  },
  async lockMigration(id: string): Promise<OpeningBalanceMigrationDto> {
    return await invoke<OpeningBalanceMigrationDto>('lock_opening_balance_migration', { id });
  },
  async allocateNetProfit(request: AllocateNetProfitRequest): Promise<NetProfitAllocationDto> {
    return await invoke<NetProfitAllocationDto>('allocate_net_profit', { request });
  },
};