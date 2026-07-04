import { invoke } from '@shared/lib/invoke';
import type { InventoryLotDto, MaterialPriceHistoryDto } from '@erp/shared-types';

export const lotService = {
  async getAvailableLots(materialId: string): Promise<InventoryLotDto[]> {
    return await invoke<InventoryLotDto[]>('get_material_available_lots', { materialId });
  },

  async getCostingMethod(materialId: string): Promise<string> {
    return await invoke<string>('get_material_costing_method', { materialId });
  },

  async updateCostingMethod(materialId: string, costingMethod: string): Promise<void> {
    return await invoke<void>('update_material_costing_method', { materialId, costingMethod });
  },

  async getMaterialLots(materialId: string): Promise<InventoryLotDto[]> {
    return await invoke<InventoryLotDto[]>('get_material_lots', { materialId });
  },

  async updateLotSalePrices(lotId: string, retailPriceBase?: string | null, semiWholesalePriceBase?: string | null, wholesalePriceBase?: string | null): Promise<void> {
    return await invoke<void>('update_lot_sale_prices', { lotId, retailPriceBase, semiWholesalePriceBase, wholesalePriceBase });
  },

  async getPurchasePriceHistory(materialId: string, unitId?: string): Promise<MaterialPriceHistoryDto> {
    return await invoke<MaterialPriceHistoryDto>('get_material_purchase_price_history', { materialId, unitId });
  },
};
