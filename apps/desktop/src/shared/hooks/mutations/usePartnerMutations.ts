import { useMutation, useQueryClient } from "@tanstack/react-query";
import { partnerService, type PartnerRequest } from "@modules/partners/api/partnerService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { toast } from "sonner";

export function useCreatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: PartnerRequest) => partnerService.addPartner(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.partners });
      toast.success("تم إضافة الشريك بنجاح");
    },
    onError: (e: Error) => toast.error("فشل إضافة الشريك: " + e.message),
  });
}

export function useUpdatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: PartnerRequest) => partnerService.updatePartner(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.partners });
      toast.success("تم تحديث الشريك بنجاح");
    },
    onError: (e: Error) => toast.error("فشل تحديث الشريك: " + e.message),
  });
}

export function useDeletePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => partnerService.deletePartner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.partners });
      toast.success("تم حذف الشريك بنجاح");
    },
    onError: (e: Error) => toast.error("فشل حذف الشريك: " + e.message),
  });
}
