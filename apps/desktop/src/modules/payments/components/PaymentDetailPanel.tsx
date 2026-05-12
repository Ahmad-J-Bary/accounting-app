import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { X, Pencil, Trash2, Receipt } from "lucide-react";
import type { Payment, AccountDto, CustomerDto, SupplierDto } from "@erp/shared-types";
import { Button } from "@shared/ui/button";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Textarea } from "@shared/ui/textarea";
import { PAYMENT_TYPE_LABELS } from "../lib/constants";
import { formatCurrency } from "@shared/lib/format";
import { useMemo } from "react";

interface PaymentDetailPanelProps {
  payment: Payment;
  accounts: AccountDto[];
  customers: CustomerDto[];
  suppliers: SupplierDto[];
  onClose: () => void;
  onEdit: (payment: Payment) => void;
  onDelete: (id: string) => void;
}

export function PaymentDetailPanel({
  payment,
  accounts,
  customers,
  suppliers,
  onClose,
  onEdit,
  onDelete,
}: PaymentDetailPanelProps) {
  const { formatAmount } = useCurrencyContext();

  const getAccountName = (id?: string) => accounts.find(a => a.id === id)?.name_ar || "-";
  const getCustomerName = (id?: string) => customers.find(c => c.id === id)?.name || "-";
  const getSupplierName = (id?: string) => suppliers.find(s => s.id === id)?.name || "-";

  const { displayAmount, amountInSyp } = useMemo(() => {
    const amt = parseFloat(payment.amount) || 0;
    const rate = parseFloat(payment.exchange_rate) || 1;
    let syp = 0;
    if (payment.currency_code === "SYP") {
      syp = amt;
    } else {
      syp = amt * rate;
    }
    return {
      displayAmount: formatAmount(amt, { currencyCode: payment.currency_code }),
      amountInSyp: formatAmount(syp, { currencyCode: "SYP" })
    };
  }, [payment, formatAmount]);

  if (!payment) return null;

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50 shrink-0">
        <div className="flex flex-col gap-1 text-right">
          <h2 className="text-lg font-bold text-slate-800">بيانات السند</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-amber-500 text-white hover:bg-amber-600 border-none h-8 px-3 rounded-lg"
            onClick={() => onEdit(payment)}
          >
            <Pencil className="w-3.5 h-3.5 ml-1.5" />
            تعديل
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-rose-500 text-white hover:bg-rose-600 border-none h-8 px-3 rounded-lg"
            onClick={() => onDelete(payment.id)}
          >
            <Trash2 className="w-3.5 h-3.5 ml-1.5" />
            حذف
          </Button>
          <div className="h-4 w-px bg-slate-300 mx-1"></div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-full h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-8">

          {/* Type & Amounts */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 mb-4">
              <Receipt className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-base">المعلومات الأساسية</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-medium text-slate-500">رقم السند</Label>
                <div className="font-medium text-slate-800 text-sm">
                  {payment.voucher_number || "-"}
                </div>
              </div>
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-medium text-slate-500">رقم القيد</Label>
                <div className="font-medium text-slate-800 text-sm bg-slate-100 px-2 py-1 rounded inline-block">
                  {payment.journal_entry_number || "-"}
                </div>
              </div>
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-medium text-slate-500">نوع السند</Label>
                <div className="font-medium text-slate-800 text-sm">
                  {PAYMENT_TYPE_LABELS[payment.payment_type as keyof typeof PAYMENT_TYPE_LABELS] || payment.payment_type}
                </div>
              </div>
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-medium text-slate-500">تاريخ السند</Label>
                <div className="font-medium text-slate-800 text-sm">
                  {new Date(payment.payment_date).toLocaleDateString("ar-SA")}
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-right">
                  <Label className="text-xs font-medium text-slate-500">المبلغ ({payment.currency_code})</Label>
                  <div className="font-bold text-slate-800 text-lg">
                    {displayAmount}
                  </div>
                </div>
                {payment.currency_code !== "SYP" && (
                  <div className="space-y-1 text-right">
                    <Label className="text-xs font-medium text-slate-500">المبلغ (ل.س)</Label>
                    <div className="font-bold text-slate-800 text-lg">
                      {amountInSyp}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100"></div>

          {/* Accounts */}
          <div className="space-y-4 text-right">
            <h3 className="font-semibold text-sm text-slate-800 mb-3">الحسابات</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">الحساب المدين / الوجهة</Label>
                <Input 
                  value={getAccountName(payment.debit_account_id)} 
                  readOnly 
                  className="bg-slate-50/50 border-slate-200 h-9 text-sm text-slate-700" 
                  dir="rtl"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">الحساب الدائن / المصدر</Label>
                <Input 
                  value={getAccountName(payment.credit_account_id)} 
                  readOnly 
                  className="bg-slate-50/50 border-slate-200 h-9 text-sm text-slate-700" 
                  dir="rtl"
                />
              </div>

              {payment.customer_id && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500">العميل</Label>
                  <Input 
                    value={getCustomerName(payment.customer_id)} 
                    readOnly 
                    className="bg-slate-50/50 border-slate-200 h-9 text-sm text-slate-700" 
                    dir="rtl"
                  />
                </div>
              )}

              {payment.supplier_id && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500">المورد</Label>
                  <Input 
                    value={getSupplierName(payment.supplier_id)} 
                    readOnly 
                    className="bg-slate-50/50 border-slate-200 h-9 text-sm text-slate-700" 
                    dir="rtl"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-slate-100"></div>

          {/* Details */}
          <div className="space-y-4 text-right pb-4">
            <h3 className="font-semibold text-sm text-slate-800 mb-3">تفاصيل إضافية</h3>
            <div className="grid grid-cols-1 gap-4">
              {payment.reference && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500">رقم المرجع</Label>
                  <Input 
                    value={payment.reference} 
                    readOnly 
                    className="bg-slate-50/50 border-slate-200 h-9 text-sm text-slate-700" 
                    dir="rtl"
                  />
                </div>
              )}
              
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">البيان</Label>
                <Textarea 
                  value={payment.notes || "-"} 
                  readOnly 
                  className="bg-slate-50/50 border-slate-200 resize-none text-sm text-slate-700 min-h-[80px]" 
                  dir="rtl"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
