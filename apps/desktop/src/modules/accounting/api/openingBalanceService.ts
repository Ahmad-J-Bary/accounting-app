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

export const openingBalanceService = {
  async createMigration(request: CreateOpeningBalanceMigrationRequest): Promise<OpeningBalanceMigrationDto> {
    return await invoke<OpeningBalanceMigrationDto>('create_opening_balance_migration', { request });
  },
  async listMigrations(): Promise<OpeningBalanceMigrationDto[]> {
    return await invoke<OpeningBalanceMigrationDto[]>('list_opening_balance_migrations', {});
  },
  async postMigration(id: string): Promise<OpeningBalanceMigrationDto> {
    return await invoke<OpeningBalanceMigrationDto>('post_opening_balance_migration', { id });
  },
};