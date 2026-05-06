import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@shared/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { StatusBadge } from '@widgets/stats/StatusBadge';
import { formatCurrency, formatDate } from '@shared/lib/format';
import { Phone, MapPin } from "lucide-react";
import type { CustomerDto, InvoiceDto, Payment } from "@erp/shared-types";

interface CustomerDetailsProps {
  customer: CustomerDto | null;
  onClose: () => void;
  invoices: InvoiceDto[];
  payments: Payment[];
  loadingDetails: boolean;
}

export function CustomerDetails({ customer, onClose, invoices, payments, loadingDetails }: CustomerDetailsProps) {
  return (
    <Sheet open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        {customer && (
          <>
            <SheetHeader className="text-right">
              <SheetTitle>ملف العميل - {customer.name}</SheetTitle>
            </SheetHeader>

            <div className="mt-6 grid grid-cols-2 gap-3 text-right">
              <div className="p-3 border border-border rounded-md">
                <div className="text-xs text-muted-foreground">الرصيد الحالي</div>
                <div className="font-bold tabular-nums text-primary">{formatCurrency(Number(customer.balance || 0))}</div>
              </div>
              <div className="p-3 border border-border rounded-md">
                <div className="text-xs text-muted-foreground">الحالة</div>
                <div className="font-bold"><StatusBadge status={customer.is_active ? "active" : "inactive"} /></div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-right">
              <div className="flex items-center gap-2 text-sm justify-start"><Phone className="w-4 h-4 text-muted-foreground" />{customer.phone || "لا يوجد هاتف"}</div>
              <div className="flex items-center gap-2 text-sm justify-start"><MapPin className="w-4 h-4 text-muted-foreground" />{customer.address || "لا يوجد عنوان"}</div>
            </div>

            <Tabs defaultValue="invoices" className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invoices">الفواتير</TabsTrigger>
                <TabsTrigger value="payments">المقبوضات</TabsTrigger>
              </TabsList>
              
              <TabsContent value="invoices">
                {loadingDetails ? <div className="text-center py-10">جاري التحميل...</div> :
                  invoices.length === 0 ? <div className="text-center py-10 text-muted-foreground">لا توجد فواتير</div> :
                  <div className="border rounded-xl overflow-hidden text-xs bg-white shadow-sm">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="text-right p-3 font-bold">الرقم</th>
                          <th className="text-right p-3 font-bold">التاريخ</th>
                          <th className="text-left p-3 font-bold">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {invoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 font-medium text-blue-600">{inv.invoice_number}</td>
                            <td className="p-3 text-slate-500">{formatDate(inv.issued_at)}</td>
                            <td className="p-3 text-left tabular-nums font-bold">{formatCurrency(parseFloat(inv.total_amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
              </TabsContent>
              
              <TabsContent value="payments">
                {loadingDetails ? <div className="text-center py-10">جاري التحميل...</div> :
                  payments.length === 0 ? <div className="text-center py-10 text-muted-foreground">لا توجد مقبوضات</div> :
                  <div className="border rounded-xl overflow-hidden text-xs bg-white shadow-sm">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="text-right p-3 font-bold">التاريخ</th>
                          <th className="text-right p-3 font-bold">المرجع</th>
                          <th className="text-left p-3 font-bold">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {payments.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 text-slate-500">{formatDate(p.payment_date)}</td>
                            <td className="p-3">{p.reference || "-"}</td>
                            <td className="p-3 text-left tabular-nums text-green-600 font-bold">+{formatCurrency(parseFloat(p.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
