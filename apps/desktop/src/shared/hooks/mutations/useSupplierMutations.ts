import { supplierService } from "@modules/partners/api/supplierService";
import { QUERY_KEYS, ALL_REPORT_KEYS } from "@shared/hooks/queryClient";
import { createEntityMutations } from "./createEntityMutations";
import type { CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

const { useCreate, useUpdate, useDelete } = createEntityMutations<
  CreateSupplierRequest,
  UpdateSupplierRequest
>({
  queryKey: QUERY_KEYS.suppliers,
  mutations: {
    create: { fn: (req) => supplierService.create(req), successMsg: "تم إضافة المورد بنجاح",   errorMsg: "فشل إضافة المورد", extraInvalidations: ALL_REPORT_KEYS },
    update: { fn: (req) => supplierService.update(req), successMsg: "تم تحديث المورد بنجاح",  errorMsg: "فشل تحديث المورد", extraInvalidations: ALL_REPORT_KEYS },
    delete: { fn: (id)  => supplierService.delete(id),  successMsg: "تم حذف المورد بنجاح",    errorMsg: "فشل حذف المورد", extraInvalidations: ALL_REPORT_KEYS },
  },
});

export { useCreate as useCreateSupplier, useUpdate as useUpdateSupplier, useDelete as useDeleteSupplier };
