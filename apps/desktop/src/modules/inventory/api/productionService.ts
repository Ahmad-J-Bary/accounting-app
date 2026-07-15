import { invoke } from '@shared/lib/invoke';
import type { ProductionOrder, CreateProductionOrderRequest } from '@erp/shared-types';

export const productionService = {
  async create(request: CreateProductionOrderRequest): Promise<ProductionOrder> {
    return await invoke<ProductionOrder>('create_production_order', { request });
  },

  async list(): Promise<ProductionOrder[]> {
    return await invoke<ProductionOrder[]>('list_production_orders');
  },

  async get(id: string): Promise<ProductionOrder> {
    return await invoke<ProductionOrder>('get_production_order', { id });
  },
};
