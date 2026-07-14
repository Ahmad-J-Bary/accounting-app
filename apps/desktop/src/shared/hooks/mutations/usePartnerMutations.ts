import { partnerService } from "@modules/partners/api/partnerService";
import { QUERY_KEYS, ALL_REPORT_KEYS } from "@shared/hooks/queryClient";
import { createEntityMutations } from "./createEntityMutations";
import type { PartnerRequest } from "@erp/shared-types";

const { useCreate, useUpdate, useDelete } = createEntityMutations<PartnerRequest, PartnerRequest>({
  queryKey: QUERY_KEYS.partners,
  mutations: {
    create: { fn: (req) => partnerService.addPartner(req),    successMsg: "تم إضافة الشريك بنجاح",   errorMsg: "فشل إضافة الشريك",   extraInvalidations: ALL_REPORT_KEYS },
    update: { fn: (req) => partnerService.updatePartner(req), successMsg: "تم تحديث الشريك بنجاح",  errorMsg: "فشل تحديث الشريك",  extraInvalidations: ALL_REPORT_KEYS },
    delete: { fn: (id)  => partnerService.deletePartner(id),  successMsg: "تم حذف الشريك بنجاح",    errorMsg: "فشل حذف الشريك",    extraInvalidations: ALL_REPORT_KEYS },
  },
});

export { useCreate as useCreatePartner, useUpdate as useUpdatePartner, useDelete as useDeletePartner };
