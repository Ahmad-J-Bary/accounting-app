import { invoke } from '@shared/lib/invoke';
import type { OpeningPositionControlDto, ResidualClassificationSpecDto } from '@erp/shared-types';

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
  source_system?: string | null;
  source_reference?: string | null;
}

export interface UpdateOpeningMigrationLinesRequest extends CreateOpeningBalanceMigrationRequest {
  migration_id: string;
}

export interface SetResidualClassificationRequest {
  migration_id: string;
  classification: string;
  residual_account_id?: string | null;
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
  posted: boolean;
}

/**
 * The source/context of a profit distribution — ONE distribution engine
 * consumes this explicit source instead of the frontend rebuilding per-source
 * logic. Mirrors the backend `ProfitDistributionSource` enum as an external
 * (serde) tagged union:
 *   { OpeningMigration: { migration_id } } | { ClosedPeriod: { period_id } }
 */
export type ProfitDistributionSource =
  | { OpeningMigration: { migration_id: string } }
  | { ClosedPeriod: { period_id: string } };

export interface DistributeProfitCommand {
  source: ProfitDistributionSource;
  net_profit: string;
  /**
   * Client-supplied idempotency key: re-submitting the SAME key resolves the
   * already-posted distribution instead of creating a duplicate journal. A
   * different key is a NEW (e.g. partial) distribution event.
   */
  idempotency_key: string;
}

export interface PreviewProfitDistributionCommand {
  source: ProfitDistributionSource;
  net_profit: string;
}

export interface ComputedNetProfitDto {
  net_profit: string;
  total_revenue: string;
  total_expenses: string;
  entry_count: number;
}

export interface ComputeNetProfitRequest {
  migration_id: string;
  period_start?: string | null;
  period_end?: string | null;
}

export interface OpeningItemInput {
  kind: string; // KIND_AR | KIND_AP | KIND_INVENTORY | KIND_FIXED_ASSET | KIND_BANK | KIND_LOAN
  entity_id: string; // real customer/supplier/material/asset id or ledger AccountId for bank/loan
  reference?: string | null;
  amount: string; // AR/AP net balance, inventory total cost, FA net book value, bank/loan balance
  qty: string;
}

export interface OpeningItemsDto {
  items: OpeningItemInput[];
}

export interface SaveOpeningItemsRequest {
  migration_id: string;
  items: OpeningItemInput[];
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
  async updateMigrationLines(request: UpdateOpeningMigrationLinesRequest): Promise<OpeningBalanceMigrationDto> {
    return await invoke<OpeningBalanceMigrationDto>('update_opening_balance_migration_lines', { request });
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
  async allocateNetProfit(request: DistributeProfitCommand): Promise<NetProfitAllocationDto> {
    return await invoke<NetProfitAllocationDto>('allocate_net_profit', { request });
  },
  async previewProfitDistribution(request: PreviewProfitDistributionCommand): Promise<NetProfitAllocationDto> {
    return await invoke<NetProfitAllocationDto>('preview_profit_distribution', { request });
  },
  async computeNetProfit(request: ComputeNetProfitRequest): Promise<ComputedNetProfitDto> {
    return await invoke<ComputedNetProfitDto>('compute_opening_balance_net_profit', { request });
  },
  async saveMigrationItems(request: SaveOpeningItemsRequest): Promise<OpeningItemsDto> {
    return await invoke<OpeningItemsDto>('save_opening_balance_items', { command: request });
  },
  async getReconciliation(id: string): Promise<OpeningReconciliationDto> {
    return await invoke<OpeningReconciliationDto>('get_opening_balance_reconciliation', { id });
  },
  async setResidualClassification(
    request: SetResidualClassificationRequest,
  ): Promise<void> {
    return await invoke<void>('set_opening_balance_residual_classification', { request });
  },
  async applyResidual(migrationId: string): Promise<void> {
    return await invoke<void>('apply_opening_balance_residual_classification', { id: migrationId });
  },
  async getResidualClassificationSpec(): Promise<ResidualClassificationSpecDto[]> {
    return await invoke<ResidualClassificationSpecDto[]>('get_opening_balance_residual_classification_spec', {});
  },
  async getOpeningPositionControl(id: string): Promise<OpeningPositionControlDto> {
    return await invoke<OpeningPositionControlDto>('get_opening_position_control', { id });
  },
  async getOpeningDraft(): Promise<string | null> {
    return await invoke<string | null>('get_opening_wizard_draft', {});
  },
  async saveOpeningDraft(data: string): Promise<void> {
    return await invoke<void>('save_opening_wizard_draft', { data });
  },
  async clearOpeningDraft(): Promise<void> {
    return await invoke<void>('clear_opening_wizard_draft', {});
  },
};