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
}

export interface CreateMaterialRequest {
  name: string;
  barcode?: string;
  code?: string;
  minimum_stock: string;
  category_ids: string[];
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
