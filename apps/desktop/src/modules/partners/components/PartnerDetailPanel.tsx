import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { formatDate } from '@shared/lib/format';
import { Phone, MapPin, FileText, Receipt, Hash, X, Wallet } from "lucide-react";
import type { InvoiceDto, Payment, CustomerDto, SupplierDto, PartnerDto } from "@erp/shared-types";
import { Button } from "@shared/ui/button";
import { useCurrencyContext } from "@app/providers/CurrencyProvider";

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
  const { currencies, formatAmount, baseCurrency } = useCurrencyContext();
  
  if (!partner) return null;

  const isCustomer = type === "customer";
  const balanceLabel = isCustomer ? "الرصيد الحالي" : "الرصيد المستحق له";
  const transactionsLabel = isCustomer ? "المقبوضات" : "المدفوعات";

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50 shrink-0">
        <div className="flex flex-col gap-1 text-right">
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
        {/* Multi-Currency Balances */}
        <div className="space-y-3 text-right">
           <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest px-1">{balanceLabel}</h4>
           <div className="grid grid-cols-1 gap-2">
              {currencies.map(curr => (
                <div key={curr.code} className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                         <Wallet className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{curr.name_ar}</span>
                   </div>
                   <div className="text-lg font-black tabular-nums text-slate-900">
                      {formatAmount(Number(partner.balance || 0), { currencyCode: curr.code })}
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Basic Info */}
        <div className="mt-8 space-y-4 text-right p-5 border border-slate-100 rounded-2xl bg-slate-50/30">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">معلومات الاتصال</h4>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4 text-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 shadow-sm border border-blue-100">
                <Phone className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase">رقم الهاتف</span>
                <span className="font-bold text-slate-700 tabular-nums">{partner.phone || "—"}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0 shadow-sm border border-emerald-100">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase">العنوان</span>
                <span className="font-bold text-slate-700">{partner.address || "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs for Transactions */}
        <Tabs defaultValue="invoices" className="mt-10">
          <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-slate-100/80 rounded-xl">
            <TabsTrigger value="invoices" className="flex items-center gap-2 text-xs font-bold rounded-lg data-[state=active]:shadow-sm">
              <FileText className="w-3.5 h-3.5" /> الفواتير
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2 text-xs font-bold rounded-lg data-[state=active]:shadow-sm">
              <Receipt className="w-3.5 h-3.5" /> {transactionsLabel}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="invoices" className="mt-5 focus-visible:outline-none">
            {loadingDetails ? (
              <div className="text-center py-10 text-muted-foreground animate-pulse text-sm">جاري التحميل...</div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground bg-slate-50/50">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <span className="text-xs font-medium">لا توجد فواتير مسجلة</span>
              </div>
            ) : (
              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-4 font-black text-slate-400 uppercase">رقم الفاتورة</th>
                      <th className="p-4 font-black text-slate-400 uppercase">التاريخ</th>
                      <th className="p-4 font-black text-slate-400 uppercase text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-blue-600">{inv.invoice_number}</td>
                        <td className="p-4 text-slate-500 font-medium">{formatDate(inv.issued_at)}</td>
                        <td className="p-4 text-left tabular-nums font-black text-slate-900">
                          {formatAmount(parseFloat(inv.total_amount), { currencyCode: inv.currency_code })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="payments" className="mt-5 focus-visible:outline-none">
            {loadingDetails ? (
              <div className="text-center py-10 text-muted-foreground animate-pulse text-sm">جاري التحميل...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground bg-slate-50/50">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <span className="text-xs font-medium">لا توجد {transactionsLabel} مسجلة</span>
              </div>
            ) : (
              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-4 font-black text-slate-400 uppercase">التاريخ</th>
                      <th className="p-4 font-black text-slate-400 uppercase">المرجع</th>
                      <th className="p-4 font-black text-slate-400 uppercase text-left">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-slate-500 font-medium">{formatDate(p.payment_date)}</td>
                        <td className="p-4 font-bold text-slate-700">{p.reference || "—"}</td>
                        <td className={`p-4 text-left tabular-nums font-black ${isCustomer ? "text-emerald-600" : "text-red-600"}`}>
                          {isCustomer ? "+" : "-"}{formatAmount(parseFloat(p.amount), { currencyCode: (p as { currency_code?: string }).currency_code || baseCurrency?.code })}
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
          <div className="mt-10 border-t border-slate-100 pt-8">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1">ملاحظات إضافية</h4>
            <div className="bg-amber-50/30 p-5 rounded-2xl border border-amber-100 text-amber-900/80 text-xs leading-relaxed shadow-sm">
              {partner.notes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
