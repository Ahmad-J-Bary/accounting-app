import { customerService } from "@modules/partners/api/customerService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { createEntityMutations } from "./createEntityMutations";
import type { CreateCustomerRequest, UpdateCustomerRequest } from "@erp/shared-types";

const { useCreate, useUpdate, useDelete } = createEntityMutations<
  CreateCustomerRequest,
  UpdateCustomerRequest
>({
  queryKey: QUERY_KEYS.customers,
  mutations: {
    create: { fn: (req) => customerService.create(req), successMsg: "تم إضافة العميل بنجاح",   errorMsg: "فشل إضافة العميل" },
    update: { fn: (req) => customerService.update(req), successMsg: "تم تحديث العميل بنجاح",  errorMsg: "فشل تحديث العميل" },
    delete: { fn: (id)  => customerService.delete(id),  successMsg: "تم حذف العميل بنجاح",    errorMsg: "فشل حذف العميل" },
  },
});

export { useCreate as useCreateCustomer, useUpdate as useUpdateCustomer, useDelete as useDeleteCustomer };
