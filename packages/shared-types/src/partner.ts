export interface PartnerDto {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  debit: string;
  credit: string;
  opening_balance: string;
  balance: string;
  currency: string;
  notes: string | null;
  is_active: boolean;
  exchange_rate: string;
  amount_local: string;
  amount_original: string;
  is_amount_in_original: boolean;
  profit_sharing_ratio: string | null;
  profit_sharing_type: string;
  linked_account_id: string | null;
  drawings_account_id: string | null;
}

export interface PartnerRequest {
  [key: string]: unknown;
  id?: string;
  code: string;
  name: string;
  exchangeRate: string;
  amount: string;
  isAmountInOriginal: boolean;
  sharingType: string;
  manualRatio: string | null;
}
