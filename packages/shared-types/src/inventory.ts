export interface DamagedItem {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: string;
  reason: string;
  damage_date: string;
  cost_impact: string;
  notes?: string;
  created_at: string;
}

export interface CreateDamagedItemRequest {
  product_id: string;
  quantity: number;
  reason: string;
  damage_date: string;
  cost_impact: number;
  notes?: string;
}

// ---- Stock Adjustment ----
export interface StockAdjustment {
  id: string;
  product_id: string;
  product_name?: string;
  system_quantity: string;
  actual_quantity: string;
  difference: string;
  reason?: string;
  adjustment_date: string;
  created_at: string;
}

export interface CreateStockAdjustmentRequest {
  product_id: string;
  actual_quantity: number;
  reason?: string;
  adjustment_date: string;
}

// ---- Production Order ----
export interface ProductionMaterial {
  id: string;
  product_id: string;
  product_name?: string;
  quantity_required: string;
  quantity_consumed: string;
}

export interface ProductionOutput {
  id: string;
  product_id: string;
  product_name?: string;
  quantity_produced: string;
  unit_cost: string;
}

export interface ProductionOrder {
  id: string;
  order_number: string;
  materials: ProductionMaterial[];
  outputs: ProductionOutput[];
  status: 'Draft' | 'InProgress' | 'Completed' | 'Cancelled';
  production_date: string;
  notes?: string;
  total_cost: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductionMaterialRequest {
  product_id: string;
  quantity_required: number;
}

export interface CreateProductionOutputRequest {
  product_id: string;
  quantity_produced: number;
  unit_cost: number;
}

export interface CreateProductionOrderRequest {
  order_number: string;
  materials: CreateProductionMaterialRequest[];
  outputs: CreateProductionOutputRequest[];
  production_date: string;
  notes?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string;
  movement_type: 'In' | 'Out' | 'Adjustment' | 'Production' | 'Damaged';
  quantity: string;
  unit_cost?: string;
  total_cost?: string;
  reference?: string;
  notes?: string;
  date: string;
  created_at: string;
}
