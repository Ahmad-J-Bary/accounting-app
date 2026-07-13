import { warehouseService } from "@modules/inventory/api/warehouseService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { createEntityMutations } from "./createEntityMutations";
import type { CreateWarehouseRequest, UpdateWarehouseRequest } from "@erp/shared-types";

const { useCreate, useUpdate, useDelete } = createEntityMutations<
  CreateWarehouseRequest,
  UpdateWarehouseRequest
>({
  queryKey: QUERY_KEYS.warehouses,
  mutations: {
    create: { fn: (data) => warehouseService.create(data), successMsg: "تم إضافة المستودع بنجاح",   errorMsg: "فشل إضافة المستودع" },
    update: { fn: (data) => warehouseService.update(data), successMsg: "تم تحديث المستودع بنجاح",  errorMsg: "فشل تحديث المستودع" },
    delete: { fn: (id)   => warehouseService.delete(id),   successMsg: "تم حذف المستودع بنجاح",    errorMsg: "فشل حذف المستودع" },
  },
});

export { useCreate as useCreateWarehouse, useUpdate as useUpdateWarehouse, useDelete as useDeleteWarehouse };
