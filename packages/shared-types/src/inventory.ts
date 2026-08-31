export interface DamagedItem {
  id: string;
  material_id: string;
  material_name?: string;
  quantity: string;
  reason: string;
  damage_date: string;
  cost_impact: string;
  cost_impact_base?: string;
  currency_code?: string;
  fx_rate?: string;
  notes?: string;
  reference?: string | null;
  created_at: string;
}

export interface CreateDamagedItemRequest {
  material_id: string;
  quantity: number;
  reason: string;
  damage_date: string;
  cost_impact: number;
  currency_code?: string;
  fx_rate?: number;
  notes?: string;
}

export interface UpdateDamagedItemRequest {
  id: string;
  material_id: string;
  quantity: number;
  reason: string;
  damage_date: string;
  cost_impact: number;
  currency_code?: string;
  fx_rate?: number;
  notes?: string;
}

// ---- Stock Adjustment ----
export interface StockAdjustment {
  id: string;
  material_id: string;
  material_name?: string;
  system_quantity: string;
  actual_quantity: string;
  difference: string;
  reason?: string;
  unit_cost: string;
  unit_cost_base: string;
  total_cost: string;
  total_cost_base: string;
  currency_code?: string;
  fx_rate?: string;
  notes?: string;
  reference?: string | null;
  adjustment_date: string;
  created_at: string;
}

export interface CreateStockAdjustmentRequest {
  material_id: string;
  actual_quantity: number;
  unit_cost: number;
  currency_code?: string;
  fx_rate?: number;
  reason?: string;
  notes?: string;
  adjustment_date: string;
}

export interface UpdateStockAdjustmentRequest {
  id: string;
  material_id: string;
  actual_quantity: number;
  unit_cost: number;
  currency_code?: string;
  fx_rate?: number;
  reason?: string;
  notes?: string;
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

export interface InventoryLotDto {
  id: string;
  material_id: string;
  purchase_invoice_id?: string | null;
  movement_id: string;
  quantity_original: string;
  quantity_remaining: string;
  unit_cost_base: string;
  raw_unit_cost_base: string;
  currency_code?: string | null;
  fx_rate: string;
  purchase_date: string;
  created_at: string;
  retail_price_base?: string | null;
  semi_wholesale_price_base?: string | null;
  wholesale_price_base?: string | null;
}

export interface StockMovement {
  id: string;
  material_id: string;
  material_name?: string | null;
  movement_type: string;
  quantity: string;
  unit_cost?: string | null;
  unit_cost_base?: string | null;
  total_cost?: string | null;
  total_cost_base?: string | null;
  original_currency?: string | null;
  fx_rate?: string | null;
  reference?: string | null;
  source_document_id?: string | null;
  reason?: string | null;
  warehouse_id?: string | null;
  movement_date: string;
  created_at: string;
  signed_quantity?: string | null;
}

export interface CreateTransferRequest {
  source_warehouse_id: string;
  dest_warehouse_id: string;
  material_id: string;
  quantity: string;
  transfer_date: string;
  notes?: string | null;
}

export interface TransferResponse {
  reference: string;
  source_movement_id: string;
  dest_movement_id: string;
  source_warehouse_id: string;
  dest_warehouse_id: string;
  material_id: string;
  quantity: string;
  transfer_date: string;
}

export interface UpdateTransferRequest {
  reference: string;
  source_warehouse_id: string;
  dest_warehouse_id: string;
  material_id: string;
  quantity: string;
  transfer_date: string;
  notes?: string | null;
}

export interface PriceHistoryEntryDto {
  price_base: string;
  invoice_number?: string | null;
  purchase_date?: string | null;
  lot_id: string;
}

export interface MaterialPriceHistoryDto {
  first_cost_base: string | null;
  average_cost_base: string;
  last_cost_base: string | null;
  history: PriceHistoryEntryDto[];
}
