import { invoke } from '@shared/lib/invoke';
import type { StockMovement } from '@erp/shared-types';

export const stockMovementService = {
  async list(): Promise<StockMovement[]> {
    return await invoke<StockMovement[]>('list_stock_movements');
  },

  async getStockBalance(materialId: string): Promise<string> {
    return await invoke<string>('get_stock_balance', { materialId });
  },
};
