import type { AccountDto, CustomerDto, PartnerDto, SupplierDto } from "@erp/shared-types";
import type { ResolvedTreeNode } from "@shared/tree/nodeTypes";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useCompanyCapabilities } from "@shared/hooks";
import { effectiveBalance, balanceDirectionLabel } from "@shared/lib/balance-utils";
import { toFixed } from "@shared/lib/format";
import {
  useLinkedCustomer,
  useLinkedSupplier,
  useLinkedPartner,
  type PartnerAccountRole,
} from "./useLinkedEntity";
import { usePartnerProfitRatio } from "./usePartnerProfitRatio";
import type { AccountField, LinkedEntityKind } from "../lib/account-fields";

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

export interface LinkedEntityFieldsResult {
  /** Loading state of the linked-entity query (false when not linked). */
  isLoading: boolean;
  /** "customer" | "supplier" | "partner" when an entity is linked, else null. */
  kind: LinkedEntityKind | null;
  /** Arabic title used for the merged grid header. */
  title: string;
  /** Entity-side grid fields (never overlap the account-grid keys they replace). */
  fields: AccountField[];
}

/**
 * Reads the entity linked to a COA account and exposes ONLY the fields that
 * belong to that entity — they are merged with the "بيانات الحساب" grid by
 * `mergeAccountEntityFields` afterwards. Customer/supplier grids no longer
 * carry a العملة field (the partner/customer/supplier pages own it); the
 * partner-capital grid shows the capital amounts + the computed profit share,
 * while drawings/current show partner identity + account role only.
 */
export function useLinkedEntityFields(
  resolved: ResolvedTreeNode | null | undefined,
  account: AccountDto | null,
): LinkedEntityFieldsResult {
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
    isPartner ? (account?.id ?? null) : null,
    isPartner ? (resolved.linkedPartnerRole ?? null) : null,
  );

  const query = isPartner ? partnerQuery : isCustomer ? customerQuery : supplierQuery;
  // Unconditional hook call per the rules of hooks — disabled until the partner
  // id is known (after the partner list loads), then shared with the partners
  // page cache via `QUERY_KEYS.partners`.
  const profitRatio = usePartnerProfitRatio(
    isPartner ? (query.data?.id ?? null) : null,
  );
  const isLoading = (isCustomer || isSupplier || isPartner) && query.isLoading;
  const kind: LinkedEntityKind | null = isCustomer
    ? "customer"
    : isSupplier
      ? "supplier"
      : isPartner
        ? "partner"
        : null;
  const title = isCustomer
    ? "بيانات الحساب والعميل"
    : isSupplier
      ? "بيانات الحساب والمورد"
      : isPartner
        ? "بيانات الحساب والشريك"
        : "بيانات الحساب";

  const entity = query.data;
  if (!kind || !entity) return { isLoading, kind, title, fields: [] };

  if (isPartner) {
    const partner = entity as PartnerDto;
    const role = resolved?.linkedPartnerRole ?? "capital";

    // Drawings / current accounts carry a real working balance, so the COA grid
    // shows only the partner identity + account role (identity-first edit).
    if (role === "drawings" || role === "current") {
      return {
        isLoading,
        kind,
        title,
        fields: [
          { key: "partner-name", label: "الشريك", value: partner.name || "—" },
          { key: "partner-role", label: "دور الحساب", value: ROLE_LABELS[role] },
        ],
      };
    }

    const currencyName = currencies.find((c) => c.code === (partner.currency || baseCurrency?.code));

    return {
      isLoading,
      kind,
      title,
      fields: [
        { key: "partner-role", label: "دور الحساب", value: ROLE_LABELS[role] },
        {
          key: "partner-amount-original",
          label: "المبلغ المشارك به",
          value: `${toFixed(parseFloat(partner.amount_original || "0"), 2)} ${currencyName?.symbol || partner.currency || ""}`.trim(),
        },
        {
          key: "partner-amount-local",
          label: `المبلغ (${baseCurrency?.symbol || baseCurrency?.code || ""})`,
          value: toFixed(parseFloat(partner.amount_local || "0"), 2),
        },
        {
          key: "partner-ratio",
          label: "نسبة الأرباح المخصصة (%)",
          value: profitRatio != null ? `${toFixed(profitRatio, 2)}%` : "—",
        },
        {
          key: "partner-distribution",
          label: "طريقة التوزيع",
          value: PROFIT_TYPE_LABELS[partner.profit_sharing_type] || "—",
        },
      ],
    };
  }

  const p = entity as CustomerDto | SupplierDto;
  const type = isCustomer ? "customer" : "supplier";
  const bal = effectiveBalance(parseFloat(p.debit || "0") || 0, parseFloat(p.credit || "0") || 0, type);

  const fields: AccountField[] = [
    { key: "entity-phone", label: "رقم الهاتف", value: p.phone || "—" },
    { key: "entity-address", label: "العنوان", value: p.address || "—" },
  ];

  if (canAccessOpeningWorkflow) {
    fields.push({ key: "entity-opening", label: "الرصيد الافتتاحي", value: p.opening_balance || "0" });
    fields.push({
      key: "entity-direction",
      label: "اتجاه الرصيد",
      value: balanceDirectionLabel(parseFloat(p.debit || "0") || 0, parseFloat(p.credit || "0") || 0, type),
    });
  }

  fields.push({ key: "entity-balance", label: "الرصيد الحالي", value: String(bal) });

  return { isLoading, kind, title, fields };
}