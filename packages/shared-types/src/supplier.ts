export interface SupplierDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  balance: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierRequest {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
}

export interface UpdateSupplierRequest {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
}
