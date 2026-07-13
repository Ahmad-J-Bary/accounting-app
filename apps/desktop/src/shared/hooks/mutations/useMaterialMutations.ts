import { materialService } from "@modules/inventory/api/materialService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { createEntityMutations } from "./createEntityMutations";
import type { CreateMaterialRequest, UpdateMaterialRequest } from "@erp/shared-types";

const { useCreate, useUpdate, useDelete } = createEntityMutations<
  CreateMaterialRequest,
  UpdateMaterialRequest
>({
  queryKey: QUERY_KEYS.materials,
  mutations: {
    create: { fn: (req) => materialService.createMaterial(req), successMsg: "تم إضافة المادة بنجاح",   errorMsg: "فشل إضافة المادة" },
    update: { fn: (req) => materialService.updateMaterial(req), successMsg: "تم تحديث المادة بنجاح",  errorMsg: "فشل تحديث المادة" },
    delete: { fn: (id)  => materialService.deleteMaterial(id),  successMsg: "تم حذف المادة بنجاح",    errorMsg: "فشل حذف المادة" },
  },
});

export { useCreate as useCreateMaterial, useUpdate as useUpdateMaterial, useDelete as useDeleteMaterial };
