export interface CustomerDto {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  account_id: string | null;
  debit: string;
  credit: string;
  opening_balance: string;
  balance: string;
  currency: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerRequest {
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  account_id?: string | null;
  debit?: string | null;
  credit?: string | null;
  opening_balance?: string | null;
  currency?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface UpdateCustomerRequest {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  account_id?: string | null;
  debit?: string | null;
  credit?: string | null;
  opening_balance?: string | null;
  currency?: string | null;
  notes?: string | null;
  is_active: boolean;
}
