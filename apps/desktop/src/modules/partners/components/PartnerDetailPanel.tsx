import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { StatusBadge } from '@widgets/stats/StatusBadge';
import { formatCurrency, formatDate } from '@shared/lib/format';
import { Phone, MapPin, FileText, Receipt, Hash, X } from "lucide-react";
import type { InvoiceDto, Payment, CustomerDto, SupplierDto, PartnerDto } from "@erp/shared-types";
import { Button } from "@shared/ui/button";

interface PartnerDetailPanelProps {
  type: "customer" | "supplier";
  partner: CustomerDto | SupplierDto | PartnerDto | null;
  onClose: () => void;
  invoices: InvoiceDto[];
  payments: Payment[];
  loadingDetails: boolean;
}

export function PartnerDetailPanel({
  type,
  partner,
  onClose,
  invoices,
  payments,
  loadingDetails
}: PartnerDetailPanelProps) {
  if (!partner) return null;

  const isCustomer = type === "customer";
  const balanceLabel = isCustomer ? "الرصيد الحالي" : "الرصيد الحالي المستحق له";
  const balanceColor = isCustomer ? "text-primary" : "text-red-600";
  const transactionsLabel = isCustomer ? "المقبوضات" : "المدفوعات";

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50 shrink-0">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            {partner.name}
            <span className="text-xs font-normal text-muted-foreground bg-white border px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
              <Hash className="w-3 h-3" /> {partner.code}
            </span>
          </h2>
          <span className="text-xs text-muted-foreground">{isCustomer ? "ملف العميل" : "ملف المورد"}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 text-right">
          <div className="p-4 border border-border rounded-xl bg-slate-50/50 shadow-sm">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">{balanceLabel}</div>
            <div className={`font-bold tabular-nums text-xl ${balanceColor}`}>
              {formatCurrency(parseFloat(partner.balance || "0"))}
            </div>
          </div>
          <div className="p-4 border border-border rounded-xl bg-slate-50/50 shadow-sm">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">الحالة</div>
            <div className="mt-1.5">
              <StatusBadge status={partner.is_active ? "active" : "inactive"} />
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="mt-6 space-y-4 text-right p-5 border border-slate-100 rounded-xl bg-white shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2">معلومات الاتصال</h4>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-medium">رقم الهاتف</div>
                <div className="font-medium text-slate-700">{partner.phone || "—"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-medium">العنوان</div>
                <div className="font-medium text-slate-700">{partner.address || "—"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs for Transactions */}
        <Tabs defaultValue="invoices" className="mt-8">
          <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-slate-100/80 rounded-lg">
            <TabsTrigger value="invoices" className="flex items-center gap-2 text-xs rounded-md">
              <FileText className="w-3.5 h-3.5" /> الفواتير
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2 text-xs rounded-md">
              <Receipt className="w-3.5 h-3.5" /> {transactionsLabel}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="invoices" className="mt-4 focus-visible:outline-none">
            {loadingDetails ? (
              <div className="text-center py-10 text-muted-foreground animate-pulse text-sm">جاري التحميل...</div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-slate-50/50">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <span className="text-xs">لا توجد فواتير مسجلة</span>
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
                        <td className="p-3 text-left tabular-nums font-bold text-slate-700">
                          {formatCurrency(parseFloat(inv.total_amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="payments" className="mt-4 focus-visible:outline-none">
            {loadingDetails ? (
              <div className="text-center py-10 text-muted-foreground animate-pulse text-sm">جاري التحميل...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-slate-50/50">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <span className="text-xs">لا توجد {transactionsLabel} مسجلة</span>
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
                        <td className="p-3 font-medium text-slate-700">{p.reference || "—"}</td>
                        <td className={`p-3 text-left tabular-nums font-bold ${isCustomer ? "text-emerald-600" : "text-red-600"}`}>
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
            <p className="text-xs bg-amber-50/50 p-4 rounded-lg border border-amber-100 text-amber-900 leading-relaxed shadow-sm">
              {partner.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
