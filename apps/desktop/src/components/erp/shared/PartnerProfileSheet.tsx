import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Phone, MapPin, FileText, Receipt, Hash } from "lucide-react";
import type { InvoiceDto, Payment } from "@erp/shared-types";

interface PartnerProfileSheetProps {
  type: "customer" | "supplier";
  partner: any | null; // Unified DTO
  onClose: () => void;
  invoices: InvoiceDto[];
  payments: Payment[];
  loadingDetails: boolean;
}

export function PartnerProfileSheet({
  type,
  partner,
  onClose,
  invoices,
  payments,
  loadingDetails
}: PartnerProfileSheetProps) {
  const isCustomer = type === "customer";
  const balanceLabel = isCustomer ? "الرصيد الحالي" : "الرصيد الحالي المستحق له";
  const balanceColor = isCustomer ? "text-primary" : "text-red-600";
  const transactionsLabel = isCustomer ? "المقبوضات" : "المدفوعات";

  return (
    <Sheet open={!!partner} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        {partner && (
          <>
            <SheetHeader className="text-right">
              <SheetTitle className="flex items-center gap-2">
                {isCustomer ? "ملف العميل" : "ملف المورد"} - {partner.name}
                <span className="text-xs font-normal text-muted-foreground bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <Hash className="w-3 h-3" /> {partner.code}
                </span>
              </SheetTitle>
            </SheetHeader>

            {/* Quick Stats */}
            <div className="mt-6 grid grid-cols-2 gap-3 text-right">
              <div className="p-3 border border-border rounded-lg bg-slate-50/50">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{balanceLabel}</div>
                <div className={`font-bold tabular-nums text-lg ${balanceColor}`}>
                  {formatCurrency(parseFloat(partner.balance || "0"))}
                </div>
              </div>
              <div className="p-3 border border-border rounded-lg bg-slate-50/50">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">الحالة</div>
                <div className="mt-1">
                  <StatusBadge status={partner.is_active ? "active" : "inactive"} />
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="mt-6 space-y-3 text-right p-4 border rounded-lg">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">معلومات الاتصال</h4>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">رقم الهاتف</div>
                  <div className="font-medium">{partner.phone || "—"}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">العنوان</div>
                  <div className="font-medium">{partner.address || "—"}</div>
                </div>
              </div>
            </div>

            {/* Tabs for Transactions */}
            <Tabs defaultValue="invoices" className="mt-8">
              <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-slate-100/50">
                <TabsTrigger value="invoices" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" /> الفواتير
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex items-center gap-2">
                  <Receipt className="w-4 h-4" /> {transactionsLabel}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="invoices" className="mt-4">
                {loadingDetails ? (
                  <div className="text-center py-10 text-muted-foreground animate-pulse">جاري التحميل...</div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    لا توجد فواتير مسجلة
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="p-3 font-bold text-slate-500">رقم الفاتورة</th>
                          <th className="p-3 font-bold text-slate-500">التاريخ</th>
                          <th className="p-3 font-bold text-slate-500 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {invoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 font-bold text-blue-600">{inv.invoice_number}</td>
                            <td className="p-3 text-slate-500">{formatDate(inv.issued_at)}</td>
                            <td className="p-3 text-left tabular-nums font-bold">
                              {formatCurrency(parseFloat(inv.total_amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="payments" className="mt-4">
                {loadingDetails ? (
                  <div className="text-center py-10 text-muted-foreground animate-pulse">جاري التحميل...</div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    لا توجد {transactionsLabel} مسجلة
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="p-3 font-bold text-slate-500">التاريخ</th>
                          <th className="p-3 font-bold text-slate-500">المرجع</th>
                          <th className="p-3 font-bold text-slate-500 text-left">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {payments.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 text-slate-500">{formatDate(p.payment_date)}</td>
                            <td className="p-3 font-medium">{p.reference || "—"}</td>
                            <td className={`p-3 text-left tabular-nums font-bold ${isCustomer ? "text-green-600" : "text-red-600"}`}>
                              {isCustomer ? "+" : "-"}{formatCurrency(parseFloat(p.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Notes Section */}
            {partner.notes && (
              <div className="mt-8 border-t pt-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ملاحظات إضافية</h4>
                <p className="text-sm bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-600 leading-relaxed">
                  {partner.notes}
                </p>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
