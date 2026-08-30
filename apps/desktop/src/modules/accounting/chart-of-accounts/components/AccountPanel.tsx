import type { AccountDto } from "@erp/shared-types";
import { DetailPanel } from "@widgets/sidebar-shell/DetailPanel";
import { SidebarDetailGrid } from "@widgets/sidebar-shell/SidebarDetailGrid";
import type { ResolvedTreeNode } from "@shared/tree/nodeTypes";
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

const LINKED_BADGES: Partial<Record<ResolvedTreeNode["entityType"], string>> = {
  "customer-account": "مرتبط بعميل",
  "supplier-account": "مرتبط بمورد",
  "fixed-asset-account": "حساب أصل ثابت",
  root: "الدليل الجذر",
};

/**
 * Side-panel content of the Chart of Accounts page. View mode renders the
 * unified DetailPanel with a detail grid; create/edit render the AccountForm
 * inside the shared FormPanel. Action buttons live in the page header, not here.
 */
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
  // Hooks must run on every render, before any early return. The entity query
  // is disabled when the selected node is not a linked account, so nothing is
  // fetched in create/edit or for plain accounts.
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

  const badge = resolved
    ? resolved.entityType === "partner-account"
      ? resolved.linkedPartnerRole === "drawings"
        ? "حساب المسحوبات (شريك)"
        : resolved.linkedPartnerRole === "current"
          ? "الحساب الجاري للشريك"
          : "حساب رأس مال الشريك"
      : LINKED_BADGES[resolved.entityType]
    : undefined;
  const typeMeta = TYPE_LABELS[selected.account_type];
  const categoryLabel =
    selected.category === "Summary"
      ? "مجموعة ملخص"
      : selected.category === "Detail"
        ? "حساب تفصيلي"
        : selected.category;

  // Single merged detail grid: "بيانات الحساب" + the linked entity panel, with
  // duplicate العملة / الرصيد entries removed (see `mergeAccountEntityFields`).
  const accountFields: AccountField[] = [
    { key: "account-code", label: "رقم الحساب", value: selected.code ?? "—" },
    { key: "account-name", label: "اسم الحساب", value: selected.name_ar ?? "—" },
    {
      key: "account-parent",
      label: "فرعي من",
      value: parentName && parentName.trim().length > 0 ? parentName : "—",
    },
    { key: "account-level", label: "المستوى", value: String(selected.level ?? 1) },
    {
      key: "account-type",
      label: "نوع الحساب",
      value: typeMeta?.label ?? selected.account_type ?? "—",
    },
    { key: "account-category", label: "التصنيف", value: categoryLabel ?? "—" },
    { key: "account-is-final", label: "حساب نهائي (ورقة)", value: selected.is_final ? "نعم" : "لا" },
    { key: "account-currency", label: "العملة", value: selected.currency || "—" },
    { key: "account-balance", label: "الرصيد", value: selected.balance ?? "0" },
  ];

  const mergedFields = mergeAccountEntityFields(
    accountFields,
    entity.fields,
    entity.kind,
    resolved?.linkedPartnerRole ?? null,
  );

  return (
      <DetailPanel title="تفاصيل الحساب" subtitle={selected.code ?? undefined} onClose={onClose}>
        {badge && (
          <div className="flex items-center">
            <span className="inline-flex items-center rounded-lg bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 text-xs font-bold">
              {badge}
            </span>
          </div>
        )}
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