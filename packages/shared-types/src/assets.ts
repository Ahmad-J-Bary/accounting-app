export interface CurrencyDto {
  code: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  decimals: number;
  is_base: boolean;
  is_active: boolean;
  notes?: string | null;
}

export interface MoneyDto {
  amount: string;
  currency: CurrencyDto;
}

export interface FixedAssetDto {
  id: string;
  code: string;
  name: string;
  category_id: string;
  warehouse_id?: string | null;
  purchase_date: string;
  purchase_cost: MoneyDto;
  fx_rate: string;
  useful_life_months: number;
  salvage_value?: MoneyDto | null;
  accumulated_depreciation: MoneyDto;
  depreciation_method: string;
  status: 'Active' | 'Disposed' | 'Sold' | 'Damaged';
  location?: string;
  notes?: string;
  asset_account_id: string;
  depreciation_account_id: string;
  accumulated_depreciation_account_id: string;
  created_at: string;
  updated_at: string;
}

export interface ConsumableDto {
  id: string;
  code: string;
  name: string;
  category_id: string;
  quantity_on_hand: string;
  unit_cost: {
    amount: string;
    currency: string;
  };
  fx_rate: string;
  status: 'InStock' | 'Exhausted' | 'Damaged';
  location?: string;
  notes?: string;
}

export interface AssetCategoryDto {
  id: string;
  name: string;
  asset_type: 'Fixed' | 'Consumable';
}

export interface AssetMovement {
  id: string;
  asset_id: string;
  asset_name?: string;
  movement_type: 'Acquisition' | 'Depreciation' | 'Disposal' | 'Sale' | 'Adjustment' | 'Transfer' | 'Issue' | 'Consumption' | 'Damage' | 'Revaluation';
  quantity?: string;
  amount: MoneyDto;
  date: string;
  description?: string;
  reference_no?: string;
  journal_entry_id?: string;
  created_at: string;
}

export interface CreateFixedAssetRequest {
  code: string;
  name: string;
  category_id: string;
  warehouse_id?: string;
  purchase_date: string;
  purchase_cost: string;
  currency: string;
  fx_rate: string;
  useful_life_months: number;
  asset_account_id: string;
  depreciation_account_id: string;
  accumulated_depreciation_account_id: string;
  payment_account_id: string;
  addition_type?: string;
  notes?: string;
  location?: string;
  salvage_value?: string;
  depreciation_method?: string;
}

export interface CreateConsumableRequest {
  code: string;
  name: string;
  categoryId: string;
  unitCost: string;
  currency: string;
  fxRate: string;
  assetAccountId: string;
  expenseAccountId: string;
}
