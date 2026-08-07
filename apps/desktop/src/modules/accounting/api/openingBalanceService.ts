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

export interface ComputedNetProfitDto {
  net_profit: string;
  total_revenue: string;
  total_expenses: string;
  gross_profit: string;
  entry_count: number;
}

export interface ComputeNetProfitRequest {
  migration_id: string;
}

export interface OpeningCustomerItem {
  customer_id: string;
  reference?: string | null;
  original_amount: string;
  outstanding_amount: string;
  due_date?: string | null;
  currency_code?: string | null;
  exchange_rate?: string | null;
}

export interface OpeningSupplierItem {
  supplier_id: string;
  reference?: string | null;
  original_amount: string;
  outstanding_amount: string;
  due_date?: string | null;
  currency_code?: string | null;
  exchange_rate?: string | null;
}

export interface OpeningInventoryItem {
  material_id: string;
  warehouse_id?: string | null;
  quantity: string;
  unit_cost: string;
  total_cost: string;
  batch?: string | null;
  currency_code?: string | null;
}

export interface OpeningFixedAssetItem {
  asset_id: string;
  acquisition_cost: string;
  accumulated_depreciation: string;
  net_book_value: string;
  acquisition_date?: string | null;
  depreciation_method?: string | null;
  useful_life?: string | null;
}

export interface OpeningDetailsDto {
  customer_items: OpeningCustomerItem[];
  supplier_items: OpeningSupplierItem[];
  inventory_items: OpeningInventoryItem[];
  fixed_assets: OpeningFixedAssetItem[];
}

export interface ReconciliationRow {
  key: string;
  subledger: string;
  general_ledger: string;
  reconciled: boolean;
}

export interface OpeningReconciliationDto {
  rows: ReconciliationRow[];
  all_reconciled: boolean;
  opening_control_balance: string;
  debit_total: string;
  credit_total: string;
  debit_equals_credit: boolean;
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
  async reopenMigration(id: string): Promise<OpeningBalanceMigrationDto> {
    return await invoke<OpeningBalanceMigrationDto>('reopen_opening_balance_migration', { id });
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
  async computeNetProfit(request: ComputeNetProfitRequest): Promise<ComputedNetProfitDto> {
    return await invoke<ComputedNetProfitDto>('compute_opening_balance_net_profit', { request });
  },
  async saveDetails(
    request: OpeningDetailsDto & { migration_id: string },
  ): Promise<OpeningDetailsDto> {
    return await invoke<OpeningDetailsDto>('save_opening_balance_details', { command: request });
  },
  async getReconciliation(id: string): Promise<OpeningReconciliationDto> {
    return await invoke<OpeningReconciliationDto>('get_opening_balance_reconciliation', { id });
  },
};