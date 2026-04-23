export interface CustomerDto {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  balance: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerRequest {
  name: string;
  phone: string | null;
  address: string | null;
}

export interface UpdateCustomerRequest {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
}
