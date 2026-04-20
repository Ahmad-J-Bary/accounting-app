export interface CustomerDto {
  id: string;
  name: string;
  email: string | null; // Corrected to match Option<String>
  phone: string;
  address: string | null;
  balance: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerRequest {
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
}

export interface UpdateCustomerRequest {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  is_active: boolean;
}
