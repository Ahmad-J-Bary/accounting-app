import { paymentService } from "@modules/payments/api/paymentService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { createEntityMutations } from "./createEntityMutations";
import type { CreatePaymentRequest } from "@erp/shared-types";

const { useCreate, useDelete } = createEntityMutations<CreatePaymentRequest, unknown>({
  queryKey: QUERY_KEYS.payments,
  mutations: {
    create: { fn: (req) => paymentService.createPayment(req), successMsg: "تم تسجيل السند بنجاح", errorMsg: "فشل تسجيل السند" },
    delete: { fn: (id)  => paymentService.deletePayment(id),  successMsg: "تم حذف السند بنجاح",    errorMsg: "فشل حذف السند" },
  },
});

export { useCreate as useCreatePayment, useDelete as useDeletePayment };
