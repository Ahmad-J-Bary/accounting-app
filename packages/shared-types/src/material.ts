export interface MaterialUnitDto {
  id: string;
  material_id: string;
  name: string;
  conversion_factor: string;
  barcode?: string;
  is_base: boolean;
}

export interface StockMovementDetailDto {
  id: string;
  material_id: string;
  movement_type: string;
  movement_type_label: string;
  quantity: string;
  unit_cost: string;
  unit_cost_base: string;
  total_cost: string;
  total_cost_base: string;
  currency?: string;
  fx_rate: string;
  reference: string;
  notes: string;
  movement_date: string;
  invoice_number?: string;
  invoice_type?: string;
  party_name?: string;
  balance_before: string;
  balance_after: string;
  is_inflow: boolean;
}

export interface MaterialPurchasePriceDto {
  id: string;
  unit_id: string;
  price: string;
  price_base: string;
  currency: string;
}

export interface MaterialSalePriceDto {
  id: string;
  unit_id: string;
  tier: string;
  price: string;
  price_base: string;
  min_price: string;
  min_price_base: string;
  currency: string;
}

export interface MaterialDto {
  id: string;
  name: string;
  name_en: string;
  barcode: string;
  code: string;
  is_active: boolean;
  category_ids: string[];
  minimum_stock: string;
  notes?: string | null;
  image_path?: string | null;
  default_purchase_unit_id?: string | null;
  default_sale_unit_id?: string | null;
  purchase_prices: MaterialPurchasePriceDto[];
  sale_prices: MaterialSalePriceDto[];
  // Summary Fields
  total_received: string;
  total_sold: string;
  total_available: string;
  total_damaged: string;
  last_purchase_price: string;
  last_purchase_price_base: string;
  last_sale_price: string;
  last_sale_price_base: string;
  average_cost: string;
  average_cost_base: string;
  units: MaterialUnitDto[];
}

export interface CreateMaterialUnitRequest {
  name: string;
  conversion_factor: string;
  barcode?: string | null;
}

export interface CreateMaterialPriceRequest {
  unit_id: string;
  price: string;
  price_base: string;
  currency: string;
}

export interface CreateMaterialSalePriceRequest {
  unit_id: string;
  tier: string;
  price: string;
  price_base: string;
  min_price: string;
  min_price_base: string;
  currency: string;
}

export interface CreateMaterialRequest {
  name: string;
  name_en?: string;
  barcode?: string;
  code?: string;
  minimum_stock: string;
  category_ids: string[];
  units: CreateMaterialUnitRequest[];
  notes?: string;
  image_path?: string;
  default_purchase_unit_id?: string;
  default_sale_unit_id?: string;
  purchase_prices: CreateMaterialPriceRequest[];
  sale_prices: CreateMaterialSalePriceRequest[];
}

export interface UpdateMaterialRequest {
  id: string;
  name: string;
  name_en: string;
  barcode: string;
  code: string;
  minimum_stock: string;
  is_active: boolean;
  category_ids: string[];
  notes?: string | null;
  image_path?: string | null;
  default_purchase_unit_id?: string | null;
  default_sale_unit_id?: string | null;
  purchase_prices: CreateMaterialPriceRequest[];
  sale_prices: CreateMaterialSalePriceRequest[];
}

export interface AddMaterialUnitRequest {
  material_id: string;
  name: string;
  conversion_factor: string;
  barcode?: string;
}

export interface UpdateMaterialUnitRequest {
  id: string;
  name: string;
  conversion_factor: string;
  barcode?: string;
}
