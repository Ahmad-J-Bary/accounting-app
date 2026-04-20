export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  balance: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierRequest {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface UpdateSupplierRequest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}
