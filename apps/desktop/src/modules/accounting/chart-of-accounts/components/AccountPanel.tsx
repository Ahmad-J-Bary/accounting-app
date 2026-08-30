import type { AccountDto } from "@erp/shared-types";
import { DetailPanel } from "@widgets/sidebar-shell/DetailPanel";
import { SidebarDetailGrid } from "@widgets/sidebar-shell/SidebarDetailGrid";
import type { ResolvedTreeNode } from "@shared/tree/nodeTypes";
import { AccountForm } from "./AccountForm";

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
  "partner-account": "حساب شريك",
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
  if (mode !== "view") {
    return (
      <AccountForm
        open
        mode={mode}
        selected={mode === "edit" ? selected : null}
        parentAccount={mode === "create" ? parentAccount : null}
        allAccounts={allAccounts}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  if (!selected) return null;

  const badge = resolved ? LINKED_BADGES[resolved.entityType] : undefined;

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
          title="بيانات الحساب"
          fields={[
            { label: "رقم الحساب", value: selected.code ?? "—" },
            { label: "اسم الحساب", value: selected.name_ar ?? "—" },
            {
              label: "فرعي من",
              value: parentName && parentName.trim().length > 0 ? parentName : "—",
            },
            { label: "المستوى", value: String(selected.level ?? 1) },
          ]}
        />
      </DetailPanel>
  );
}