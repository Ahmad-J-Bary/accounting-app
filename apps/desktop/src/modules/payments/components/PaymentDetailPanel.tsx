import { Pencil, Trash2 } from "lucide-react";
import type {
  Payment,
  AccountDto,
  CustomerDto,
  SupplierDto,
} from "@erp/shared-types";
import {
  formatWithLocale,
  useCurrencyContext,
} from "@app/providers/CurrencyContext";
import { PAYMENT_TYPE_LABELS } from "../lib/constants";
import { useMemo } from "react";
import { formatNumber } from "@shared/lib/format";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";

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

  const getAccountName = (id?: string) =>
    accounts.find((a) => a.id === id)?.name_ar || "-";
  const getCustomerName = (id?: string) =>
    customers.find((c) => c.id === id)?.name || "-";
  const getSupplierName = (id?: string) =>
    suppliers.find((s) => s.id === id)?.name || "-";

  const { displayAmount, amountInBase } = useMemo(() => {
    const amt = parseFloat(payment.amount) || 0;
    const paymentCurrency =
      currencies.find((c) => c.code === payment.currency_code) || null;
    const formatted = formatWithLocale(amt, paymentCurrency?.decimals ?? 2);
    const baseValue = baseCurrency?.code
      ? convertBetween(amt, payment.currency_code, baseCurrency.code)
      : amt;
    return {
      displayAmount: `${formatted} ${paymentCurrency?.symbol || payment.currency_code}`,
      amountInBase: baseCurrency
        ? `${formatWithLocale(baseValue, baseCurrency.decimals)} ${baseCurrency.symbol || baseCurrency.code}`
        : formatWithLocale(baseValue, 2),
    };
  }, [payment, currencies, baseCurrency, convertBetween]);

  if (!payment) return null;

  const actionItems: SidebarAction[] = [
    {
      label: "تعديل",
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(payment),
    },
    {
      label: "حذف",
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm("هل أنت متأكد من حذف هذا السند؟")) {
          onDelete(payment.id);
        }
      },
    },
  ];

  const accountFields = [
    { label: "الحساب المدين / الوجهة", value: getAccountName(payment.debit_account_id) },
    { label: "الحساب الدائن / المصدر", value: getAccountName(payment.credit_account_id) },
    ...(payment.customer_id ? [{ label: "العميل", value: getCustomerName(payment.customer_id) }] : []),
    ...(payment.supplier_id ? [{ label: "المورد", value: getSupplierName(payment.supplier_id) }] : []),
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title="بيانات السند" onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: "رقم السند", value: payment.voucher_number ? formatNumber(parseInt(payment.voucher_number) || 0) : "-" },
              { label: "رقم القيد", value: payment.journal_entry_number ? formatNumber(parseInt(payment.journal_entry_number) || 0) : "-" },
              { label: "نوع السند", value: PAYMENT_TYPE_LABELS[payment.payment_type as keyof typeof PAYMENT_TYPE_LABELS] || payment.payment_type },
              { label: "تاريخ السند", value: new Date(payment.payment_date).toLocaleDateString("ar-SA") },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: `المبلغ (${payment.currency_code})`, value: displayAmount },
              ...(payment.currency_code !== baseCurrency?.code
                ? [{ label: `المبلغ (${baseCurrency?.symbol || baseCurrency?.code || ""})`, value: amountInBase }]
                : []),
            ]}
          />
          <SidebarDetailGrid
            title="الحسابات"
            fields={accountFields}
          />
          <SidebarDetailGrid
            title="تفاصيل إضافية"
            fields={[
              ...(payment.reference ? [{ label: "رقم المرجع", value: payment.reference }] : []),
              { label: "البيان", value: payment.notes || "-" },
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}

