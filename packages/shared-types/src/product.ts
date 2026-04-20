export interface ProductDto {
  id: string;
  name: string;
  code: string;
  unit_price: string;
  cost_price: string;
  stock_quantity: string;
  minimum_stock: string;
  is_active: boolean;
}

export interface CreateProductRequest {
  name: string;
  code: string;
  unit_price: string;
  cost_price: string;
  initial_stock: string;
  minimum_stock: string;
}

export interface UpdateProductRequest {
  id: string;
  name: string;
  code: string;
  unit_price: string;
  cost_price: string;
  stock_quantity: string;
  minimum_stock: string;
  is_active: boolean;
}
