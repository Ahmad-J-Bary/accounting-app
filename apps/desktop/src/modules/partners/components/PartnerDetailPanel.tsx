import { Pencil, Trash2, BookOpen, FileText } from "lucide-react";
import type { InvoiceDto, Payment, CustomerDto, SupplierDto, PartnerDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useTabs } from "@app/providers/TabContext";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";

const PROFIT_TYPE_LABELS: Record<string, string> = {
  BasedOnCapitalLocal: "على أساس رأس المال المحلي",
  BasedOnCapitalOriginal: "على أساس رأس المال الأصلي",
  Manual: "يدوي",
};

interface PartnerDetailPanelProps {
  type: "customer" | "supplier";
  partner: CustomerDto | SupplierDto | PartnerDto;
  onClose: () => void;
  onEdit: (partner: CustomerDto | SupplierDto | PartnerDto) => void;
  onDelete: (id: string, name: string) => void;
  invoices: InvoiceDto[];
  payments: Payment[];
  loadingDetails: boolean;
}

export function PartnerDetailPanel({
  type,
  partner,
  onClose,
  onEdit,
  onDelete,
}: PartnerDetailPanelProps) {
  const { currencies, baseCurrency } = useCurrencyContext();
  const { openTab } = useTabs();

  if (!partner) return null;

  const isCustomer = type === "customer";
  const isPartner = "amount_original" in partner;
  const hasAccountId = (p: typeof partner): p is CustomerDto | SupplierDto => "account_id" in p;
  const partnerAccountId = hasAccountId(partner) ? partner.account_id : null;

  const title = isPartner
    ? "بيانات الشريك"
    : isCustomer
    ? "بيانات العميل"
    : "بيانات المورد";

  const statementPath = isCustomer
    ? `/partners/customer-statement/${partner.id}`
    : `/partners/supplier-statement/${partner.id}`;

  const actions: SidebarAction[] = [
    {
      label: "تعديل",
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(partner),
    },
    {
      label: "حذف",
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(`هل أنت متأكد من حذف "${partner.name}"؟`)) {
          onDelete(partner.id, partner.name);
        }
      },
    },
    {
      label: "اليومية",
      icon: <BookOpen className="w-4 h-4" />,
      variant: "primary",
      hidden: isPartner || !partnerAccountId,
      onClick: () =>
        openTab({
          id: `ledger-${partnerAccountId}`,
          title: `حركة: ${partner.name}`,
          path: `/accounting/account-ledger/${partnerAccountId}`,
          closable: true,
        }),
    },
    {
      label: "الكشف",
      icon: <FileText className="w-4 h-4" />,
      variant: "success",
      hidden: isPartner || !partnerAccountId,
      onClick: () =>
        openTab({
          id: `statement-${partner.id}`,
          title: `كشف: ${partner.name}`,
          path: statementPath,
          closable: true,
        }),
    },
  ];

  const currencyName = currencies.find(
    (c) => c.code === (partner.currency || baseCurrency?.code)
  );

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={title} onClose={onClose} />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        {isPartner ? (
          <div className="space-y-4 text-right">
            <SidebarDetailGrid
              columns={2}
              fields={[
                { label: "رقم الحساب", value: partner.code || "" },
                { label: "الاسم", value: partner.name },
              ]}
            />
            <SidebarDetailGrid
              columns={2}
              fields={[
                { label: `المبلغ (${baseCurrency?.symbol || baseCurrency?.code || ""})`, value: partner.amount_original || "0" },
                { label: "المبلغ (محلي)", value: partner.amount_local || "0" },
                { label: "نسبة الأرباح (%)", value: partner.profit_sharing_ratio || "تلقائي" },
                { label: "طريقة التوزيع", value: PROFIT_TYPE_LABELS[partner.profit_sharing_type || "BasedOnCapitalLocal"] },
              ]}
            />
            {partner.notes && (
              <SidebarDetailGrid
                fields={[{ label: "ملاحظات", value: partner.notes }]}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4 text-right">
            <SidebarDetailGrid
              columns={2}
              fields={[
                { label: "رقم الحساب", value: partner.code || "" },
                { label: isCustomer ? "اسم العميل" : "اسم المورد", value: partner.name },
                { label: "رقم الهاتف", value: partner.phone || "—" },
                { label: "العنوان", value: partner.address || "—" },
              ]}
            />
            <SidebarDetailGrid
              columns={2}
              fields={[
                { label: "الرصيد الافتتاحي", value: partner.opening_balance || "0" },
                { label: "العملة", value: currencyName ? `${currencyName.code} - ${currencyName.name_ar}` : baseCurrency?.code || "" },
                { label: "مدين (حالي)", value: partner.debit || "0" },
                { label: "دائن (حالي)", value: partner.credit || "0" },
                { label: "الرصيد الحالي", value: partner.balance || "0" },
              ]}
            />
            {partner.notes && (
              <SidebarDetailGrid
                fields={[{ label: "ملاحظات", value: partner.notes }]}
              />
            )}
          </div>
        )}
      </SidebarBody>
    </SidebarShell>
  );
}