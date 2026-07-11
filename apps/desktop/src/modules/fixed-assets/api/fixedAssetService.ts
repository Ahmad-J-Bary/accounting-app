import { invoke } from '@shared/lib/invoke';
import type { FixedAssetDto, AssetCategoryDto, AssetMovement, CreateFixedAssetRequest } from "@erp/shared-types";

export const fixedAssetService = {
  async list(): Promise<FixedAssetDto[]> {
    return await invoke<FixedAssetDto[]>('list_fixed_assets');
  },

  async create(req: CreateFixedAssetRequest): Promise<string> {
    return await invoke<string>('create_fixed_asset', {
      code: req.code,
      name: req.name,
      categoryId: req.category_id,
      warehouseId: req.warehouse_id ?? null,
      purchaseDate: req.purchase_date,
      purchaseCost: req.purchase_cost,
      currency: req.currency,
      fxRate: req.fx_rate,
      usefulLifeMonths: req.useful_life_months,
      assetAccountId: req.asset_account_id,
      depreciationAccountId: req.depreciation_account_id,
      accumulatedDepreciationAccountId: req.accumulated_depreciation_account_id,
      paymentAccountId: req.payment_account_id,
      additionType: req.addition_type ?? "new",
      notes: req.notes ?? null,
      location: req.location ?? null,
      salvageValue: req.salvage_value ?? null,
      depreciationMethod: req.depreciation_method ?? "StraightLine",
    });
  },

  async update(id: string, req: CreateFixedAssetRequest): Promise<void> {
    return await invoke<void>('update_fixed_asset', {
      id,
      code: req.code,
      name: req.name,
      categoryId: req.category_id,
      warehouseId: req.warehouse_id ?? null,
      purchaseDate: req.purchase_date,
      purchaseCost: req.purchase_cost,
      currency: req.currency,
      fxRate: req.fx_rate,
      usefulLifeMonths: req.useful_life_months,
      assetAccountId: req.asset_account_id,
      depreciationAccountId: req.depreciation_account_id,
      accumulatedDepreciationAccountId: req.accumulated_depreciation_account_id,
      paymentAccountId: req.payment_account_id,
      additionType: req.addition_type ?? "new",
      notes: req.notes ?? null,
      location: req.location ?? null,
      salvageValue: req.salvage_value ?? null,
      depreciationMethod: req.depreciation_method ?? "StraightLine",
    });
  },

  async delete(id: string): Promise<void> {
    return await invoke<void>('delete_fixed_asset', { assetId: id });
  },

  async listCategories(assetType: string = 'Fixed'): Promise<AssetCategoryDto[]> {
    return await invoke<AssetCategoryDto[]>('list_asset_categories', { assetType });
  },

  async createCategory(name: string, assetType: string = 'Fixed'): Promise<string> {
    return await invoke<string>('create_asset_category', { name, assetType });
  },

  async listMovements(assetId: string): Promise<AssetMovement[]> {
    return await invoke<AssetMovement[]>('list_asset_movements', { assetId });
  },

  async runYearlyRotation(date: string): Promise<Array<{
    asset_id: string;
    asset_name: string;
    depreciation_amount: number;
    accumulated_depreciation: number;
    net_book_value: number;
  }>> {
    return await invoke('run_yearly_rotation', { date });
  },
};
