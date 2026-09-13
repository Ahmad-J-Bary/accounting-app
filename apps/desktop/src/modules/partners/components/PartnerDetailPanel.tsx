import { useState, useEffect } from "react";
import { Pencil, Trash2, BookOpen, FileText, Scale } from "lucide-react";
import type { CustomerDto, SupplierDto, PartnerDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { toFixed } from "@shared/lib/format";
import { effectiveBalance, balanceDirectionLabel } from "@shared/lib/balance-utils";
import { useTabs } from "@app/providers/TabContext";
import { useCompanyCapabilities } from "@shared/hooks";
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
import { useLocalization } from "@app/providers/LocalizationProvider";

interface PartnerDetailPanelProps {
  type: "customer" | "supplier";
  partner: CustomerDto | SupplierDto | PartnerDto;
  onClose: () => void;
  onEdit: (partner: CustomerDto | SupplierDto | PartnerDto) => void;
  onDelete: (id: string, name: string) => void;
  onRefresh?: () => void;
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
  const { t } = useLocalization();
  const { openTab } = useTabs();
  const { canAccessOpeningWorkflow } = useCompanyCapabilities();
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
  const bal = effectiveBalance(pDebit, pCredit, type);
  const isBalanceZero = bal === 0;
  const hasAccountId = (p: typeof partner): p is CustomerDto | SupplierDto => "account_id" in p;
  const partnerAccountId = hasAccountId(partner) ? partner.account_id : null;

  const PROFIT_TYPE_LABELS: Record<string, string> = {
    BasedOnCapitalLocal: t("detail.profitTypeLabels.basedOnLocal", { namespace: "partners", fallback: "على أساس رأس المال المحلي" }),
    BasedOnCapitalOriginal: t("detail.profitTypeLabels.basedOnOriginal", { namespace: "partners", fallback: "على أساس رأس المال الأصلي" }),
    Manual: t("detail.profitTypeLabels.manual", { namespace: "partners", fallback: "يدوي" }),
  };

  const title = isPartner
    ? t("detail.titlePartner", { namespace: "partners", fallback: "بيانات الشريك" })
    : isCustomer
    ? t("detail.titleCustomer", { namespace: "partners", fallback: "بيانات العميل" })
    : t("detail.titleSupplier", { namespace: "partners", fallback: "بيانات المورد" });

  const statementPath = isCustomer
    ? `/partners/customer-statement/${partner.id}`
    : `/partners/supplier-statement/${partner.id}`;
  const statementTabId = isCustomer
    ? `statement-${partner.id}`
    : `statement-supplier-${partner.id}`;

  const actions: SidebarAction[] = [
    {
      label: t("actions.edit", { namespace: "partners", fallback: "تعديل" }),
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(partner),
    },
    {
      label: t("actions.delete", { namespace: "partners", fallback: "حذف" }),
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(t("detail.confirmDelete", { namespace: "partners", vars: { name: partner.name }, fallback: `هل أنت متأكد من حذف "{{name}}"؟` }))) {
          onDelete(partner.id, partner.name);
        }
      },
    },
    {
      label: t("actions.journal", { namespace: "partners", fallback: "اليومية" }),
      icon: <BookOpen className="w-4 h-4" />,
      variant: "primary",
      hidden: isPartner || !partnerAccountId,
      onClick: () =>
        openTab({
          id: `ledger-${partnerAccountId}`,
          title: t("detail.ledgerTab", { namespace: "partners", vars: { name: partner.name }, fallback: "حركة: {{name}}" }),
          path: `/accounting/account-ledger/${partnerAccountId}`,
          closable: true,
        }),
    },
    {
      label: t("actions.statement", { namespace: "partners", fallback: "الكشف" }),
      icon: <FileText className="w-4 h-4" />,
      variant: "success",
      hidden: isPartner || !partnerAccountId,
      onClick: () =>
        openTab({
          id: statementTabId,
          title: t("detail.statementTab", { namespace: "partners", vars: { name: partner.name }, fallback: "كشف: {{name}}" }),
          path: statementPath,
          closable: true,
        }),
    },
    {
      label: t("actions.settleFull", { namespace: "partners", fallback: "تسديد المبلغ كاملا" }),
      icon: <Scale className="w-4 h-4" />,
      variant: "danger",
      hidden: isPartner || !partnerAccountId || isBalanceZero || settled,
      disabled: settling,
      onClick: async () => {
        if (isBalanceZero) {
          toast.info(t("detail.balanceZeroInfo", { namespace: "partners", fallback: "الرصيد صفر — لا حاجة للتسوية" }));
          return;
        }
        const isDebt = bal > 0;
        const voucherLabel = isCustomer
          ? (isDebt ? t("detail.voucherReceiptDebt", { namespace: "partners", fallback: "سند قبض (RCV)" }) : t("detail.voucherCustomerPayment", { namespace: "partners", fallback: "سند دفع لعميل (CPY)" }))
          : (isDebt ? t("detail.voucherPayment", { namespace: "partners", fallback: "سند دفع (PAY)" }) : t("detail.voucherSupplierReceipt", { namespace: "partners", fallback: "سند قبض من مورد (SRC)" }));
        const amount = Math.abs(bal);
        const ok = confirm(t("detail.settleConfirm", { namespace: "partners", vars: { name: partner.name, voucher: voucherLabel, amount }, fallback: `تأكيد تسديد رصيد "{{name}}"؟\nسيتم إنشاء {{voucher}} بقيمة {{amount}}` }));
        if (!ok) return;
        setSettling(true);
        try {
          const entryNumber = await partnerService.settlePartnerBalance(type, partner.id);
          setSettled(true);
          onRefresh?.();
          if (entryNumber === "0") {
            toast.info(t("detail.alreadyZeroInfo", { namespace: "partners", fallback: "الرصيد صفر بالفعل — تم تحديث العرض" }));
          } else {
            toast.success(t("detail.settledSuccess", { namespace: "partners", vars: { number: entryNumber }, fallback: `تم تسديد المبلغ كاملاً — رقم القيد: {{number}}` }));
          }
        } catch (e) {
          toast.error(t("detail.settleFailed", { namespace: "partners", vars: { error: String(e) }, fallback: "فشل تسديد المبلغ: {{error}}" }));
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
                { label: t("detail.fields.name", { namespace: "partners", fallback: "الاسم" }), value: partner.name },
              ]}
            />
            <SidebarDetailGrid
              columns={2}
              fields={[
                { label: t("detail.fields.originalAmount", { namespace: "partners", fallback: "المبلغ الأصلي" }), value: `${partner.amount_original || "0"} ${currencyName?.symbol || partner.currency || ""}` },
                { label: t("detail.fields.localEquivalent", { namespace: "partners", vars: { currency: baseCurrency?.symbol || baseCurrency?.code || "" }, fallback: "المعادل ({{currency}})" }), value: partner.amount_local || "0" },
                { label: t("detail.fields.profitRatio", { namespace: "partners", fallback: "نسبة الأرباح" }), value: partner.profit_sharing_type === "Manual" && partner.profit_sharing_ratio
                  ? `${toFixed(parseFloat(partner.profit_sharing_ratio), 2)}%`
                  : t("detail.fields.autoRatio", { namespace: "partners", fallback: "تلقائي (حسب رأس المال)" }) },
                { label: t("detail.fields.distributionMethod", { namespace: "partners", fallback: "طريقة التوزيع" }), value: PROFIT_TYPE_LABELS[partner.profit_sharing_type || "BasedOnCapitalLocal"] },
              ]}
            />
          </div>
        ) : (
          <div className="space-y-4 text-right">
            <SidebarDetailGrid
              columns={2}
              fields={[
                { label: t("detail.fields.accountNumber", { namespace: "partners", fallback: "رقم الحساب" }), value: (partner as CustomerDto | SupplierDto).code || "" },
                { label: isCustomer ? t("columns.partyNameCustomer", { namespace: "partners", fallback: "اسم العميل" }) : t("columns.partyNameSupplier", { namespace: "partners", fallback: "اسم المورد" }), value: partner.name },
                { label: t("detail.fields.phone", { namespace: "partners", fallback: "رقم الهاتف" }), value: (partner as CustomerDto | SupplierDto).phone || "—" },
                { label: t("detail.fields.address", { namespace: "partners", fallback: "العنوان" }), value: (partner as CustomerDto | SupplierDto).address || "—" },
              ]}
            />
            <SidebarDetailGrid
              columns={2}
              fields={[
                ...(canAccessOpeningWorkflow
                  ? [
                      { label: t("detail.fields.openingBalance", { namespace: "partners", fallback: "الرصيد الافتتاحي" }), value: (partner as CustomerDto | SupplierDto).opening_balance || "0" },
                      { label: t("detail.fields.balanceDirection", { namespace: "partners", fallback: "اتجاه الرصيد" }), value: settled ? "—" : balanceDirectionLabel(parseFloat((partner as CustomerDto | SupplierDto).debit || "0"), parseFloat((partner as CustomerDto | SupplierDto).credit || "0"), type) },
                    ]
                  : []),
                { label: t("detail.fields.currentBalance", { namespace: "partners", fallback: "الرصيد الحالي" }), value: settled ? "0" : String(bal) },
              ]}
            />
            {(partner as CustomerDto | SupplierDto).notes && (
              <SidebarDetailGrid
                fields={[{ label: t("detail.fields.notes", { namespace: "partners", fallback: "ملاحظات" }), value: (partner as CustomerDto | SupplierDto).notes || "" }]}
              />
            )}
          </div>
        )}
      </SidebarBody>
    </SidebarShell>
  );
}
