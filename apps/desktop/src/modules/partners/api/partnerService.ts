import { invoke } from "@shared/lib/invoke";
import type { PartnerDto, PartnerRequest } from "@erp/shared-types";

export type { PartnerDto, PartnerRequest };

export const partnerService = {
  listPartners: () => invoke<PartnerDto[]>("list_partners"),
  addPartner: (data: PartnerRequest) => invoke("add_partner", data),
  updatePartner: (data: PartnerRequest) => invoke("update_partner", data),
  deletePartner: (id: string) => invoke("delete_partner", { id }),
};
