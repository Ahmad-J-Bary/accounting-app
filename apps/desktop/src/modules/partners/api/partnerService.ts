import { invoke } from "@shared/lib/invoke";
import type { PartnerDto, PartnerRequest } from "@erp/shared-types";

export type { PartnerDto, PartnerRequest };

export interface PartnerEquityRow {
  partner_id: string;
  partner_name: string;
  capital_registered: string;
  ledger_balance: string;
  drawings: string;
  profit_allocated: string;
  total_equity: string;
}

export interface PartnerEquityStatementDto {
  rows: PartnerEquityRow[];
  total_capital: string;
  total_profit_allocated: string;
  total_drawings: string;
  total_equity: string;
}

export const partnerService = {
  listPartners: () => invoke<PartnerDto[]>("list_partners"),
  addPartner: (data: PartnerRequest) => invoke<string>("add_partner", data),
  updatePartner: (data: PartnerRequest) => invoke("update_partner", data),
  deletePartner: (id: string) => invoke("delete_partner", { id }),
  settlePartnerBalance: (partnerType: string, partnerId: string) =>
    invoke<string>("settle_partner_balance", { partnerType, partnerId }),
  createCapitalContribution: (args: {
    partnerId: string;
    fundingAccountId: string;
    amount: string;
    isAmountInOriginal: boolean;
  }) => invoke<string>("create_capital_contribution", args),
  createPartnerDrawing: (args: {
    partnerId: string;
    fundingAccountId: string;
    amount: string;
    effectiveDate?: string;
    description?: string;
  }) => invoke<string>("create_partner_drawing", args),
  capitalizeRetainedEarnings: (args: {
    partnerId: string;
    amount: string;
    effectiveDate?: string;
  }) => invoke<string>("capitalize_retained_earnings", args),
  getPartnerEquityStatement: () => invoke<PartnerEquityStatementDto>("get_partner_equity_statement"),
};
