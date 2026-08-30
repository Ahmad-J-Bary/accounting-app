import type { AccountDto, CustomerDto, PartnerDto, SupplierDto } from "@erp/shared-types";
import type { ResolvedTreeNode } from "@shared/tree/nodeTypes";
import type { PartnerAccountRole } from "../hooks/useLinkedEntity";
import {
  useLinkedCustomer,
  useLinkedSupplier,
  useLinkedPartner,
} from "../hooks/useLinkedEntity";
import { SidebarDetailGrid } from "@widgets/sidebar-shell/SidebarDetailGrid";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useCompanyCapabilities } from "@shared/hooks";
import { effectiveBalance, balanceDirectionLabel } from "@shared/lib/balance-utils";
import { toFixed } from "@shared/lib/format";

const PROFIT_TYPE_LABELS: Record<string, string> = {
  BasedOnCapitalLocal: "على أساس رأس المال المحلي",
  BasedOnCapitalOriginal: "على أساس رأس المال الأصلي",
  Manual: "يدوي",
};

const ROLE_LABELS: Record<PartnerAccountRole, string> = {
  capital: "حساب رأس المال",
  drawings: "حساب المسحوبات",
  current: "الحساب الجاري",
};

interface LinkedEntityDetailsProps {
  /** Resolved classification of the selected node. */
  resolved?: ResolvedTreeNode | null;
  /** The chart-of-accounts account being viewed. */
  account: AccountDto;
}

/**
 * Read-only view of the entity (customer / supplier / partner) linked to a
 * Chart-of-Accounts account. Mirrors the fields shown on the entity's own
 * pages; account-specific info stays in the "بيانات الحساب" grid above.
 */
export function LinkedEntityDetails({ resolved, account }: LinkedEntityDetailsProps) {
  const { currencies, baseCurrency } = useCurrencyContext();
  const { canAccessOpeningWorkflow } = useCompanyCapabilities();

  const isCustomer = resolved?.entityType === "customer-account";
  const isSupplier = resolved?.entityType === "supplier-account";
  const isPartner = resolved?.entityType === "partner-account";

  const customerQuery = useLinkedCustomer(
    isCustomer ? (resolved.linkedEntityId ?? null) : null,
  );
  const supplierQuery = useLinkedSupplier(
    isSupplier ? (resolved.linkedEntityId ?? null) : null,
  );
  const partnerQuery = useLinkedPartner(
    isPartner ? account.id : null,
    isPartner ? (resolved.linkedPartnerRole ?? null) : null,
  );

  const query = isPartner ? partnerQuery : isCustomer ? customerQuery : supplierQuery;

  if (!resolved) return null;
  if (!isCustomer && !isSupplier && !isPartner) return null;

  if (query.isLoading) {
    return (
      <div className="p-4 text-center">
        <div className="mx-auto h-6 w-6 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  const entity = query.data;
  if (!entity) return null;

  const title = isPartner ? "بيانات الشريك" : isCustomer ? "بيانات العميل" : "بيانات المورد";
  const type = (isCustomer ? "customer" : "supplier") as "customer" | "supplier";

  if (isPartner) {
    const partner = entity as PartnerDto;
    const currencyName = currencies.find((c) => c.code === (partner.currency || baseCurrency?.code));
    return (
      <SidebarDetailGrid
        title={title}
        columns={2}
        fields={[
          { label: "الاسم", value: partner.name || "—" },
          { label: "دور الحساب", value: ROLE_LABELS[resolved.linkedPartnerRole ?? "capital"] },
          {
            label: "المبلغ الأصلي",
            value: `${partner.amount_original || "0"} ${currencyName?.symbol || partner.currency || ""}`,
          },
          {
            label: `المعادل (${baseCurrency?.symbol || baseCurrency?.code || ""})`,
            value: partner.amount_local || "0",
          },
          {
            label: "نسبة الأرباح",
            value:
              partner.profit_sharing_type === "Manual" && partner.profit_sharing_ratio
                ? `${toFixed(parseFloat(partner.profit_sharing_ratio), 2)}%`
                : "تلقائي (حسب رأس المال)",
          },
          {
            label: "طريقة التوزيع",
            value: PROFIT_TYPE_LABELS[partner.profit_sharing_type] || "—",
          },
        ]}
      />
    );
  }

  const p = entity as CustomerDto | SupplierDto;
  const bal = effectiveBalance(parseFloat(p.debit || "0") || 0, parseFloat(p.credit || "0") || 0, type);
  const currencyName = currencies.find((c) => c.code === (p.currency || baseCurrency?.code));

  return (
    <SidebarDetailGrid
      title={title}
      columns={2}
      fields={[
        { label: "رقم الحساب", value: p.code || "—" },
        { label: isCustomer ? "اسم العميل" : "اسم المورد", value: p.name || "—" },
        { label: "رقم الهاتف", value: p.phone || "—" },
        { label: "العنوان", value: p.address || "—" },
        ...(canAccessOpeningWorkflow
          ? [
              { label: "الرصيد الافتتاحي", value: p.opening_balance || "0" },
              {
                label: "اتجاه الرصيد",
                value: balanceDirectionLabel(parseFloat(p.debit || "0") || 0, parseFloat(p.credit || "0") || 0, type),
              },
            ]
          : []),
        {
          label: "العملة",
          value: currencyName ? `${currencyName.code} - ${currencyName.name_ar}` : baseCurrency?.code || "—",
        },
        { label: "الرصيد الحالي", value: String(bal) },
      ]}
    />
  );
}