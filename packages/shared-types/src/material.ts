export interface MaterialDto {
  id: string;
  name: string;
  barcode: string;
  code: string;
  purchase_price: string | null;
  retail_price: string | null;
  wholesale_price: string | null;
  semi_wholesale_price: string | null;
  minimum_stock: string;
  is_active: boolean;
  notes: string | null;
  category_ids: string[];
  stock_quantity: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialRequest {
  name: string;
  barcode?: string | null;
  code?: string | null;
  purchase_price?: string | null;
  retail_price?: string | null;
  wholesale_price?: string | null;
  semi_wholesale_price?: string | null;
  minimum_stock: string;
  notes?: string | null;
  category_ids: string[];
}

export interface UpdateMaterialRequest {
  id: string;
  name: string;
  barcode: string;
  code: string;
  purchase_price: string | null;
  retail_price: string | null;
  wholesale_price: string | null;
  semi_wholesale_price: string | null;
  minimum_stock: string;
  is_active: boolean;
  notes: string | null;
  category_ids: string[];
}
