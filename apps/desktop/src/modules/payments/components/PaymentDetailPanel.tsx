import { X, Pencil, Trash2, Receipt } from "lucide-react";
import type { Payment, AccountDto, CustomerDto, SupplierDto } from "@erp/shared-types";
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import { DetailPanel, ActionButton } from "@widgets/sidebar";
import { SidebarSection } from "@widgets/sidebar/SidebarSection";
import { FieldLabel } from "@widgets/sidebar/FieldLabel";
import { formatWithLocale, useCurrencyContext } from "@app/providers/CurrencyContext";
import { PAYMENT_TYPE_LABELS } from "../lib/constants";
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
  const { baseCurrency, convertBetween, currencies } = useCurrencyContext();

  const getAccountName = (id?: string) => accounts.find((a) => a.id === id)?.name_ar || "-";
  const getCustomerName = (id?: string) => customers.find((c) => c.id === id)?.name || "-";
  const getSupplierName = (id?: string) => suppliers.find((s) => s.id === id)?.name || "-";

  const { displayAmount, amountInBase } = useMemo(() => {
    const amt = parseFloat(payment.amount) || 0;
    const paymentCurrency = currencies.find((c) => c.code === payment.currency_code) || null;
    const formatted = formatWithLocale(amt, paymentCurrency?.decimals ?? 2);
    const baseValue = baseCurrency?.code ? convertBetween(amt, payment.currency_code, baseCurrency.code) : amt;
    return {
      displayAmount: `${formatted} ${paymentCurrency?.symbol || payment.currency_code}`,
      amountInBase: baseCurrency
        ? `${formatWithLocale(baseValue, baseCurrency.decimals)} ${baseCurrency.symbol || baseCurrency.code}`
        : formatWithLocale(baseValue, 2),
    };
  }, [payment, currencies, baseCurrency, convertBetween]);

  if (!payment) return null;

  const actions = (
    <>
      <ActionButton icon={<Pencil className="w-3.5 h-3.5" />} label="تعديل" color="amber" onClick={() => onEdit(payment)} />
      <ActionButton icon={<Trash2 className="w-3.5 h-3.5" />} label="حذف" color="rose" onClick={() => onDelete(payment.id)} />
    </>
  );

  return (
    <DetailPanel
      title="بيانات السند"
      icon={<Receipt className="w-5 h-5 text-emerald-500" />}
      actions={actions}
      onClose={onClose}
    >
      <SidebarSection title="المعلومات الأساسية" icon={<Receipt className="w-4 h-4 text-emerald-500" />}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>رقم السند</FieldLabel>
            <div className="font-medium text-slate-800 text-sm">{payment.voucher_number || "-"}</div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>رقم القيد</FieldLabel>
            <div className="font-medium text-slate-800 text-sm bg-slate-100 px-2 py-1 rounded inline-block">
              {payment.journal_entry_number || "-"}
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>نوع السند</FieldLabel>
            <div className="font-medium text-slate-800 text-sm">
              {PAYMENT_TYPE_LABELS[payment.payment_type as keyof typeof PAYMENT_TYPE_LABELS] || payment.payment_type}
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>تاريخ السند</FieldLabel>
            <div className="font-medium text-slate-800 text-sm">
              {new Date(payment.payment_date).toLocaleDateString("ar-SA")}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
          <div className="space-y-1 text-right">
            <FieldLabel>المبلغ ({payment.currency_code})</FieldLabel>
            <div className="font-bold text-slate-800 text-lg">{displayAmount}</div>
          </div>
          {payment.currency_code !== baseCurrency?.code && (
            <div className="space-y-1 text-right mt-2">
              <FieldLabel>{`المبلغ (${baseCurrency?.symbol || baseCurrency?.code || ""})`}</FieldLabel>
              <div className="font-bold text-slate-800 text-lg">{amountInBase}</div>
            </div>
          )}
        </div>
      </SidebarSection>

      <SidebarSection title="الحسابات">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <FieldLabel>الحساب المدين / الوجهة</FieldLabel>
            <Input value={getAccountName(payment.debit_account_id)} readOnly className="bg-slate-50/50 border-slate-200 h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>الحساب الدائن / المصدر</FieldLabel>
            <Input value={getAccountName(payment.credit_account_id)} readOnly className="bg-slate-50/50 border-slate-200 h-9 text-sm" />
          </div>
          {payment.customer_id && (
            <div className="space-y-1.5">
              <FieldLabel>العميل</FieldLabel>
              <Input value={getCustomerName(payment.customer_id)} readOnly className="bg-slate-50/50 border-slate-200 h-9 text-sm" />
            </div>
          )}
          {payment.supplier_id && (
            <div className="space-y-1.5">
              <FieldLabel>المورد</FieldLabel>
              <Input value={getSupplierName(payment.supplier_id)} readOnly className="bg-slate-50/50 border-slate-200 h-9 text-sm" />
            </div>
          )}
        </div>
      </SidebarSection>

      <SidebarSection title="تفاصيل إضافية">
        <div className="space-y-3">
          {payment.reference && (
            <div className="space-y-1.5">
              <FieldLabel>رقم المرجع</FieldLabel>
              <Input value={payment.reference} readOnly className="bg-slate-50/50 border-slate-200 h-9 text-sm" />
            </div>
          )}
          <div className="space-y-1.5">
            <FieldLabel>البيان</FieldLabel>
            <Textarea value={payment.notes || "-"} readOnly className="bg-slate-50/50 border-slate-200 resize-none text-sm min-h-[80px]" />
          </div>
        </div>
      </SidebarSection>
    </DetailPanel>
  );
}
