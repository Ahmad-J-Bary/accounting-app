import { useState, useEffect } from "react";
import { Pencil, Trash2, BookOpen, FileText, Scale } from "lucide-react";
import type { InvoiceDto, Payment, CustomerDto, SupplierDto, PartnerDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useTabs } from "@app/providers/TabContext";
import { toast } from "sonner";
import { partnerService } from "@modules/partners/api/partnerService";
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
  onRefresh?: () => void;
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
  onRefresh,
}: PartnerDetailPanelProps) {
  const { currencies, baseCurrency } = useCurrencyContext();
  const { openTab } = useTabs();
  const [settled, setSettled] = useState(false);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    setSettled(false);
  }, [partner?.id]);

  if (!partner) return null;

  const isCustomer = type === "customer";
  const isPartner = "amount_original" in partner;
  const p = partner as CustomerDto | SupplierDto;
  const pDebit = "debit" in partner ? parseFloat(p.debit) || 0 : 0;
  const pCredit = "credit" in partner ? parseFloat(p.credit) || 0 : 0;
  const effectiveBalance = isCustomer ? pDebit - pCredit : pCredit - pDebit;
  const isBalanceZero = effectiveBalance === 0;
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
    {
      label: "تسديد المبلغ كاملا",
      icon: <Scale className="w-4 h-4" />,
      variant: "danger",
      hidden: isPartner || !partnerAccountId || isBalanceZero || settled,
      disabled: settling,
      onClick: async () => {
        if (isBalanceZero) {
          toast.info("الرصيد صفر — لا حاجة للتسوية");
          return;
        }
        const isDebt = effectiveBalance > 0;
        const voucherLabel = isCustomer
          ? (isDebt ? "سند قبض (RCV)" : "سند دفع لعميل (CPY)")
          : (isDebt ? "سند دفع (PAY)" : "سند قبض من مورد (SRC)");
        const amount = Math.abs(effectiveBalance);
        const ok = confirm(`تأكيد تسديد رصيد "${partner.name}"؟\nسيتم إنشاء ${voucherLabel} بقيمة ${amount}`);
        if (!ok) return;
        setSettling(true);
        try {
          const entryNumber = await partnerService.settlePartnerBalance(type, partner.id);
          setSettled(true);
          onRefresh?.();
          if (entryNumber === "0") {
            toast.info("الرصيد صفر بالفعل — تم تحديث العرض");
          } else {
            toast.success(`تم تسديد المبلغ كاملاً — رقم القيد: ${entryNumber}`);
          }
        } catch (e) {
          toast.error("فشل تسديد المبلغ: " + e);
        } finally {
          setSettling(false);
        }
      },
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
                { label: "المبلغ الأصلي", value: `${partner.amount_original || "0"} ${currencyName?.symbol || partner.currency || ""}` },
                { label: `المعادل (${baseCurrency?.symbol || baseCurrency?.code || ""})`, value: partner.amount_local || "0" },
                { label: "نسبة الأرباح", value: partner.profit_sharing_type === "Manual" && partner.profit_sharing_ratio
                  ? `${parseFloat(partner.profit_sharing_ratio).toFixed(2)}%`
                  : "تلقائي (حسب رأس المال)" },
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
                { label: "مدين (حالي)", value: settled ? "0" : (partner.debit || "0") },
                { label: "دائن (حالي)", value: settled ? "0" : (partner.credit || "0") },
                { label: "الرصيد الحالي", value: settled ? "0" : String(effectiveBalance) },
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