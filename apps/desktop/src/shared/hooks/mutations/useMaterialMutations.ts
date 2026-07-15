import { materialService } from "@modules/inventory/api/materialService";
import { QUERY_KEYS, ALL_REPORT_KEYS } from "@shared/hooks/queryClient";
import { createEntityMutations } from "./createEntityMutations";
import type { CreateMaterialRequest, UpdateMaterialRequest } from "@erp/shared-types";

const { useCreate, useUpdate, useDelete } = createEntityMutations<
  CreateMaterialRequest,
  UpdateMaterialRequest
>({
  queryKey: QUERY_KEYS.materials,
  mutations: {
    create: { fn: (req) => materialService.create(req), successMsg: "تم إضافة المادة بنجاح",   errorMsg: "فشل إضافة المادة",   extraInvalidations: ALL_REPORT_KEYS },
    update: { fn: (req) => materialService.update(req), successMsg: "تم تحديث المادة بنجاح",  errorMsg: "فشل تحديث المادة",  extraInvalidations: ALL_REPORT_KEYS },
    delete: { fn: (id)  => materialService.delete(id),  successMsg: "تم حذف المادة بنجاح",    errorMsg: "فشل حذف المادة",    extraInvalidations: ALL_REPORT_KEYS },
  },
});

export { useCreate as useCreateMaterial, useUpdate as useUpdateMaterial, useDelete as useDeleteMaterial };
