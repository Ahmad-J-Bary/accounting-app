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
import { useMemo } from "react";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { formatNumber } from "@shared/lib/format";
import { resolveAccountName, resolvePartnerDisplayName } from "@shared/lib/system-labels";
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
  const { t, language } = useLocalization();
  const { baseCurrency, convertBetween, currencies } = useCurrencyContext();

  const getAccountName = (id?: string) => {
    const account = accounts.find((a) => a.id === id);
    return account ? resolveAccountName(account, language) : "-";
  };
  const getCustomerName = (id?: string) => {
    const c = customers.find((c) => c.id === id);
    return c ? resolvePartnerDisplayName(c.name, c.code, "customer", language, t) : "-";
  };
  const getSupplierName = (id?: string) => {
    const s = suppliers.find((s) => s.id === id);
    return s ? resolvePartnerDisplayName(s.name, s.code, "supplier", language, t) : "-";
  };

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
      label: t("actions.edit", { namespace: "common",  }),
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(payment),
    },
    {
      label: t("actions.delete", { namespace: "common",  }),
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(t("payment.deleteVoucherConfirm", { namespace: "invoicing",  }))) {
          onDelete(payment.id);
        }
      },
    },
  ];

  const accountFields = [
    { label: t("payment.debitAccount", { namespace: "invoicing",  }), value: getAccountName(payment.debit_account_id) },
    { label: t("payment.creditAccount", { namespace: "invoicing",  }), value: getAccountName(payment.credit_account_id) },
    ...(payment.customer_id ? [{ label: t("party.customer", { namespace: "partners",  }), value: getCustomerName(payment.customer_id) }] : []),
    ...(payment.supplier_id ? [{ label: t("party.supplier", { namespace: "partners",  }), value: getSupplierName(payment.supplier_id) }] : []),
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={t("payment.voucherDetails", { namespace: "invoicing",  })} onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("payment.voucherNumber", { namespace: "invoicing",  }), value: payment.voucher_number ? formatNumber(parseInt(payment.voucher_number) || 0) : "-" },
              { label: t("payment.journalEntryNo", { namespace: "invoicing",  }), value: payment.journal_entry_number ? formatNumber(parseInt(payment.journal_entry_number) || 0) : "-" },
              { label: t("payment.voucherType", { namespace: "invoicing",  }), value: t(`paymentTypeLabel.${payment.payment_type as string}`, { namespace: "invoicing"}) },
              { label: t("payment.voucherDate", { namespace: "invoicing",  }), value: new Date(payment.payment_date).toLocaleDateString("ar-SA") },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("payment.amountIn", { namespace: "invoicing", vars: { currency: payment.currency_code },  }), value: displayAmount },
              ...(payment.currency_code !== baseCurrency?.code
                ? [{ label: t("payment.amountIn", { namespace: "invoicing", vars: { currency: baseCurrency?.symbol || baseCurrency?.code || "" },  }), value: amountInBase }]
                : []),
            ]}
          />
          <SidebarDetailGrid
            title={t("payment.accounts", { namespace: "invoicing",  })}
            fields={accountFields}
          />
          <SidebarDetailGrid
            title={t("payment.extraDetails", { namespace: "invoicing",  })}
            fields={[
              ...(payment.reference ? [{ label: t("payment.referenceNumber", { namespace: "invoicing",  }), value: payment.reference }] : []),
              { label: t("payment.statement", { namespace: "invoicing",  }), value: payment.notes || "-" },
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}

