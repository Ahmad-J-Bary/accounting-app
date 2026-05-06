import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@shared/ui/sheet";
import { StatusBadge } from '@widgets/stats/StatusBadge';
import { formatCurrency } from '@shared/lib/format';
import { Phone, MapPin } from "lucide-react";
import type { SupplierDto } from "@erp/shared-types";

interface SupplierDetailsProps {
  supplier: SupplierDto | null;
  onClose: () => void;
}

export function SupplierDetails({ supplier, onClose }: SupplierDetailsProps) {
  return (
    <Sheet open={!!supplier} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        {supplier && (
          <>
            <SheetHeader className="text-right">
              <SheetTitle>ملف المورد - {supplier.name}</SheetTitle>
            </SheetHeader>

            <div className="mt-6 grid grid-cols-2 gap-3 text-right">
              <div className="p-3 border border-border rounded-md">
                <div className="text-xs text-muted-foreground">الرصيد الحالي المستحق له</div>
                <div className="font-bold tabular-nums text-red-600">{formatCurrency(parseFloat(supplier.balance || "0"))}</div>
              </div>
              <div className="p-3 border border-border rounded-md">
                <div className="text-xs text-muted-foreground">الحالة</div>
                <div className="font-bold">
                  <StatusBadge status={supplier.is_active ? "active" : "inactive"} />
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-right">
              <div className="flex items-center gap-2 text-sm justify-start">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {supplier.phone || "لا يوجد هاتف"}
              </div>
              <div className="flex items-center gap-2 text-sm justify-start">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                {supplier.address || "لا يوجد عنوان"}
              </div>
            </div>

            {/* Additional details can be added here (e.g., recent invoices, payments) */}
            <div className="mt-8 border-t pt-6">
              <h4 className="font-bold mb-4">تفاصيل إضافية</h4>
              <div className="space-y-4">
                 <div>
                   <label className="text-xs text-muted-foreground block mb-1">العنوان الكامل</label>
                   <p className="text-sm bg-slate-50 p-2 rounded">{supplier.address || "—"}</p>
                 </div>
                 <div>
                   <label className="text-xs text-muted-foreground block mb-1">ملاحظات</label>
                   <p className="text-sm bg-slate-50 p-2 rounded">{supplier.notes || "—"}</p>
                 </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
