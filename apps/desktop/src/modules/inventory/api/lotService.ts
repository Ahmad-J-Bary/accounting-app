import { invoke } from '@shared/lib/invoke';
import type { InventoryLotDto } from '@erp/shared-types';

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
};
