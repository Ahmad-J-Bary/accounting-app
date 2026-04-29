export interface PartnerDto {
  id: number;
  code: string;
  name: string;
  exchange_rate: string;
  amount_local: string;
  amount_usd: string;
  is_amount_in_usd: boolean;
  profit_sharing_ratio: string | null;
  profit_sharing_type: string;
  linked_account_id: string | null;
}

export interface PartnerRequest {
  [key: string]: unknown;
  id?: number;
  code: string;
  name: string;
  exchangeRate: string;
  amount: string;
  isAmountInUsd: boolean;
  sharingType: string;
  manualRatio: string | null;
}
