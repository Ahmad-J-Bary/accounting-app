import { invoke } from '@shared/lib/invoke';
import type {
  DamagedItem,
  CreateDamagedItemRequest,
  StockAdjustment,
  CreateStockAdjustmentRequest,
  ProductionOrder,
  CreateProductionOrderRequest,
  StockMovement,
} from '@erp/shared-types';

// Damaged Items
export const damagedService = {
  async createDamagedItem(request: CreateDamagedItemRequest): Promise<DamagedItem> {
    return await invoke<DamagedItem>('create_damaged_item', { request });
  },

  async listDamagedItems(): Promise<DamagedItem[]> {
    return await invoke<DamagedItem[]>('list_damaged_items');
  },
};

// Stock Adjustments
export const adjustmentService = {
  async createStockAdjustment(request: CreateStockAdjustmentRequest): Promise<StockAdjustment> {
    return await invoke<StockAdjustment>('create_stock_adjustment', { request });
  },

  async listStockAdjustments(): Promise<StockAdjustment[]> {
    return await invoke<StockAdjustment[]>('list_stock_adjustments');
  },
};

// Production Orders
export const productionService = {
  async createProductionOrder(request: CreateProductionOrderRequest): Promise<ProductionOrder> {
    return await invoke<ProductionOrder>('create_production_order', { request });
  },

  async listProductionOrders(): Promise<ProductionOrder[]> {
    return await invoke<ProductionOrder[]>('list_production_orders');
  },

  async getProductionOrder(id: string): Promise<ProductionOrder> {
    return await invoke<ProductionOrder>('get_production_order', { id });
  },
};

// Stock Movements
export const inventoryService = {
  async listStockMovements(): Promise<StockMovement[]> {
    return await invoke<StockMovement[]>('list_stock_movements');
  },
};
