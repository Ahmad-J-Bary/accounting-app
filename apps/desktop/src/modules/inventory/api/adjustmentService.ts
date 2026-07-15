import { createCrudService } from '@shared/lib/createService';
import type { StockAdjustment, CreateStockAdjustmentRequest, UpdateStockAdjustmentRequest } from '@erp/shared-types';

export const adjustmentService = createCrudService<StockAdjustment, CreateStockAdjustmentRequest, UpdateStockAdjustmentRequest>({
  name: 'stock_adjustment',
  pluralName: 'stock_adjustments',
});
