export interface MaterialUnitDto {
  id: string;
  material_id: string;
  name: string;
  conversion_factor: string;
  barcode?: string;
  is_base: boolean;
}

export interface MaterialDto {
  id: string;
  name: string;
  barcode: string;
  code: string;
  is_active: boolean;
  category_ids: string[];
  minimum_stock: string;
  // Summary Fields
  total_received: string;
  total_sold: string;
  total_available: string;
  total_damaged: string;
  last_purchase_price: string;
  last_sale_price: string;
  average_cost: string;
  units: MaterialUnitDto[];
}

export interface CreateMaterialUnitRequest {
  name: string;
  conversion_factor: string;
  barcode?: string | null;
}

export interface CreateMaterialRequest {
  name: string;
  barcode?: string;
  code?: string;
  minimum_stock: string;
  category_ids: string[];
  units: CreateMaterialUnitRequest[];
}

export interface UpdateMaterialRequest {
  id: string;
  name: string;
  barcode: string;
  code: string;
  minimum_stock: string;
  is_active: boolean;
  category_ids: string[];
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
