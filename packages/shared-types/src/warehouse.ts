export interface WarehouseDto {
  id: string;
  name: string;
  address?: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWarehouseRequest {
  name: string;
  address?: string | null;
}

export interface UpdateWarehouseRequest {
  id: string;
  name: string;
  address?: string | null;
  is_active: boolean;
  is_default: boolean;
}
