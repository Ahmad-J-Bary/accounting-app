import { invoke } from '@/lib/invoke';
import type { FixedAssetDto, ConsumableDto, AssetCategoryDto } from '@erp/shared-types';

export const assetService = {
  async createFixedAsset(data: {
    code: string;
    name: string;
    categoryId: string;
    purchaseDate: string;
    purchaseCost: string;
    currency: string;
    fxRate: string;
    usefulLifeMonths: number;
    assetAccountId: string;
    depreciationAccountId: string;
    accumulatedDepreciationAccountId: string;
    paymentAccountId: string;
  }): Promise<string> {
    return await invoke<string>('create_fixed_asset', data);
  },

  async listFixedAssets(): Promise<FixedAssetDto[]> {
    return await invoke<FixedAssetDto[]>('list_fixed_assets');
  },

  async createConsumable(data: {
    code: string;
    name: string;
    categoryId: string;
    unitCost: string;
    currency: string;
    fxRate: string;
  }): Promise<string> {
    return await invoke<string>('create_consumable', data);
  },

  async listConsumables(): Promise<ConsumableDto[]> {
    return await invoke<ConsumableDto[]>('list_consumables');
  },

  async listAssetCategories(assetType: 'Fixed' | 'Consumable'): Promise<AssetCategoryDto[]> {
    return await invoke<AssetCategoryDto[]>('list_asset_categories', { assetType });
  },

  async createAssetCategory(data: { name: string; assetType: 'Fixed' | 'Consumable' }): Promise<string> {
    return await invoke<string>('create_asset_category', data);
  },

  async postDepreciation(assetId: string, date: string): Promise<void> {
    return await invoke<void>('post_asset_depreciation', { assetId, date });
  },
};
