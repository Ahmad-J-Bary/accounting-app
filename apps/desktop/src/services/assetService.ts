import { invoke } from '@/lib/invoke';
import type { FixedAssetDto, ConsumableDto } from '@erp/shared-types';

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
};
