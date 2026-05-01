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
  stock_quantity: string;
  minimum_stock: string;
  purchase_price: string;
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
