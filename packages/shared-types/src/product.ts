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
  initial_stock: string;
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
