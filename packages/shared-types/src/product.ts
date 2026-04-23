export interface ProductDto {
  id: string;
  name: string;
  barcode: string | null;
  code: string;
  purchase_price: string | null;
  retail_price: string | null;
  wholesale_price: string | null;
  semi_wholesale_price: string | null;
  stock_quantity: string;
  minimum_stock: string;
  is_active: boolean;
}

export interface CreateProductRequest {
  name: string;
  barcode: string | null;
  code: string;
  purchase_price: string | null;
  retail_price: string | null;
  wholesale_price: string | null;
  semi_wholesale_price: string | null;
  minimum_stock: string;
}

export interface UpdateProductRequest {
  id: string;
  name: string;
  barcode: string | null;
  code: string;
  purchase_price: string | null;
  retail_price: string | null;
  wholesale_price: string | null;
  semi_wholesale_price: string | null;
  stock_quantity: string;
  minimum_stock: string;
  is_active: boolean;
}

export interface OpeningStockItem {
  product_id: string;
  quantity: string;
  unit_cost: string;
}

export interface RecordOpeningStockRequest {
  items: OpeningStockItem[];
  date: string;
  notes?: string | null;
}
