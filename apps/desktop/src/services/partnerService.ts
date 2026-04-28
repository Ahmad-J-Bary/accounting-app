import { invoke } from "@tauri-apps/api/core";

export interface PartnerDto {
  id: number;
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
  name: string;
  exchangeRate: string;
  amount: string;
  isAmountInUsd: boolean;
  sharingType: string;
  manualRatio: string | null;
}

export const partnerService = {
  listPartners: () => invoke<PartnerDto[]>("list_partners"),
  addPartner: (data: PartnerRequest) => invoke("add_partner", data),
  updatePartner: (data: PartnerRequest) => invoke("update_partner", data),
  deletePartner: (id: number) => invoke("delete_partner", { id }),
};
