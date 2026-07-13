import { categoryService } from "@modules/inventory/api/categoryService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { createEntityMutations } from "./createEntityMutations";
import type { CreateCategoryRequest, UpdateCategoryRequest } from "@erp/shared-types";

const { useCreate, useUpdate, useDelete } = createEntityMutations<
  CreateCategoryRequest,
  UpdateCategoryRequest
>({
  queryKey: QUERY_KEYS.categories,
  mutations: {
    create: { fn: (data) => categoryService.create(data), successMsg: "تم إضافة التصنيف بنجاح",   errorMsg: "فشل إضافة التصنيف" },
    update: { fn: (data) => categoryService.update(data), successMsg: "تم تحديث التصنيف بنجاح",  errorMsg: "فشل تحديث التصنيف" },
    delete: { fn: (id)   => categoryService.delete(id),   successMsg: "تم حذف التصنيف بنجاح",    errorMsg: "فشل حذف التصنيف" },
  },
});

export { useCreate as useCreateCategory, useUpdate as useUpdateCategory, useDelete as useDeleteCategory };
