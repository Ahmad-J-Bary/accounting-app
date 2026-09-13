import type { AccountDto } from "@erp/shared-types";
import { DetailPanel } from "@widgets/sidebar-shell/DetailPanel";
import { SidebarDetailGrid } from "@widgets/sidebar-shell/SidebarDetailGrid";
import type { ResolvedTreeNode } from "@shared/tree/nodeTypes";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { AccountForm } from "./AccountForm";
import { useLinkedEntityFields } from "../hooks/useLinkedEntityFields";
import { mergeAccountEntityFields, toDetailFields, type AccountField } from "../lib/account-fields";
import { TYPE_LABELS } from "../lib/types";

export type AccountPanelMode = "view" | "create" | "edit";

interface AccountPanelProps {
  /** Which panel content to show */
  mode: AccountPanelMode;
  /** The account in view (view mode) or being edited (edit mode) */
  selected: AccountDto | null;
  /** All chart-of-accounts entries */
  allAccounts: AccountDto[];
  /** Parent name for the view mode */
  parentName?: string | null;
  /** Parent account for create mode (null = level-1 account) */
  parentAccount?: AccountDto | null;
  /** Optional resolved classification used to render the entity badge. */
  resolved?: ResolvedTreeNode | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

/**
 * Side-panel content of the Chart of Accounts page. View mode renders the
 * unified DetailPanel with a detail grid; create/edit render the AccountForm
 * inside the shared FormPanel. Action buttons live in the page header, not here.
 */
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export function AccountPanel({
  mode,
  selected,
  allAccounts,
  parentName,
  parentAccount,
  resolved,
  onClose,
  onSaved,
}: AccountPanelProps) {
  const { t } = useLocalization();
  const { hasMultipleCurrencies } = useCurrencyContext();
  const entity = useLinkedEntityFields(resolved, selected ?? null);

  if (mode !== "view") {
    return (
      <AccountForm
        open
        mode={mode}
        selected={mode === "edit" ? selected : null}
        parentAccount={mode === "create" ? parentAccount : null}
        allAccounts={allAccounts}
        resolved={resolved}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  if (!selected) return null;

  const typeMeta = TYPE_LABELS[selected.account_type];
  const categoryLabel =
    selected.category === "Summary"
      ? t("chartOfAccounts.detail.summaryCategory", { namespace: "accounting", fallback: "مجموعة ملخص" })
      : selected.category === "Detail"
        ? t("chartOfAccounts.detail.detailCategory", { namespace: "accounting", fallback: "حساب تفصيلي" })
        : selected.category;

  // Single merged detail grid: account data + linked entity panel, with
  // duplicate currency / balance entries removed (see `mergeAccountEntityFields`).
  const accountFields: AccountField[] = [
    { key: "account-code", label: t("chartOfAccounts.detail.accountCode", { namespace: "accounting", fallback: "رقم الحساب" }), value: selected.code ?? "—" },
    { key: "account-name", label: t("chartOfAccounts.detail.accountName", { namespace: "accounting", fallback: "اسم الحساب" }), value: selected.name_ar ?? "—" },
    {
      key: "account-parent",
      label: t("chartOfAccounts.detail.parentOf", { namespace: "accounting", fallback: "فرعي من" }),
      value: parentName && parentName.trim().length > 0 ? parentName : "—",
    },
    { key: "account-level", label: t("chartOfAccounts.detail.level", { namespace: "accounting", fallback: "المستوى" }), value: String(selected.level ?? 1) },
    {
      key: "account-type",
      label: t("chartOfAccounts.detail.type", { namespace: "accounting", fallback: "نوع الحساب" }),
      value: t(`chartOfAccounts.typeLabels.${selected.account_type}`, { namespace: "accounting", fallback: typeMeta?.label ?? selected.account_type ?? "—" }),
    },
    { key: "account-category", label: t("chartOfAccounts.detail.category", { namespace: "accounting", fallback: "التصنيف" }), value: categoryLabel ?? "—" },
    { key: "account-is-final", label: t("chartOfAccounts.detail.isFinal", { namespace: "accounting", fallback: "حساب نهائي (ورقة)" }), value: selected.is_final ? t("chartOfAccounts.detail.yes", { namespace: "accounting", fallback: "نعم" }) : t("chartOfAccounts.detail.no", { namespace: "accounting", fallback: "لا" }) },
    { key: "account-currency", label: t("chartOfAccounts.detail.currency", { namespace: "accounting", fallback: "العملة" }), value: selected.currency || "—" },
    { key: "account-balance", label: t("chartOfAccounts.detail.balance", { namespace: "accounting", fallback: "الرصيد" }), value: selected.balance ?? "0" },
  ];

  const mergedFields = mergeAccountEntityFields(
    accountFields,
    entity.fields,
    entity.kind,
    resolved?.linkedPartnerRole ?? null,
    hasMultipleCurrencies,
  );

  return (
      <DetailPanel title={t("chartOfAccounts.detail.title", { namespace: "accounting", fallback: "تفاصيل الحساب" })} subtitle={selected.code ?? undefined} onClose={onClose}>
        <SidebarDetailGrid
          title={entity.title}
          columns={2}
          fields={toDetailFields(mergedFields)}
        />
        {entity.kind && entity.isLoading && (
          <div className="p-4 text-center">
            <div className="mx-auto h-6 w-6 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
          </div>
        )}
      </DetailPanel>
  );
}