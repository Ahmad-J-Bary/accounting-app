import { Plus, Edit, BookOpen, Trash2 } from "lucide-react";
import type { TranslateOptions } from "@shared/types/i18n";
import type {
  ResolvedTreeNode,
  TreeNodeAction,
  TreeNodeBranch,
  TreeNodeCreatePanelKind,
} from "./nodeTypes";

/**
 * CENTRAL action resolver — turns a resolved node into the ordered list of
 * toolbar actions (labels, tones, availability). Pages only map these
 * descriptors onto buttons; the policy lives here, once.
 */

/** Translation key map for the per-branch "new" button. */
export const CREATE_LABEL_KEYS: Record<TreeNodeCreatePanelKind, string> = {
  account: "chartOfAccounts.actions.newAccount",
  customer: "chartOfAccounts.actions.newCustomer",
  supplier: "chartOfAccounts.actions.newSupplier",
  "expense-item": "chartOfAccounts.actions.newExpenseItem",
  "fixed-asset": "chartOfAccounts.actions.newFixedAsset",
  partner: "chartOfAccounts.actions.newPartner",
};

/** Arabic branch names used in the detail panel badge. */
export const BRANCH_LABELS: Record<TreeNodeBranch, string> = {
  general: "عام",
  customers: "عملاء",
  suppliers: "موردون",
  expenses: "مصاريف",
  "fixed-assets": "أصول ثابتة",
  partners: "شركاء",
};

type TranslateFn = (key: string, options?: TranslateOptions) => string;

export interface AccountNodeActionContext {
  resolved: ResolvedTreeNode;
  t: TranslateFn;
  onNew?: () => void;
  onEdit?: () => void;
  onLedger?: () => void;
  onDelete?: () => void;
}

export function resolveAccountNodeActions(
  ctx: AccountNodeActionContext,
): TreeNodeAction[] {
  const { resolved, t, onNew, onEdit, onLedger, onDelete } = ctx;
  const { capabilities, entityType } = resolved;
  const onlyRoot = entityType === "root";

  const actions: TreeNodeAction[] = [];

  if (capabilities.canCreate && !onlyRoot) {
    actions.push({
      key: "new",
      label: t(CREATE_LABEL_KEYS[capabilities.createPanelKind ?? "account"], { namespace: "accounting" }),
      icon: Plus,
      tone: "primary",
      disabled: false,
      onClick: onNew,
    });
  }
  if (capabilities.canEdit) {
    actions.push({ key: "edit", label: t("chartOfAccounts.actions.edit", { namespace: "accounting" }), icon: Edit, disabled: false, onClick: onEdit });
  }
  if (capabilities.canViewLedger) {
    actions.push({
      key: "ledger",
      label: t("chartOfAccounts.actions.ledger", { namespace: "accounting" }),
      icon: BookOpen,
      disabled: false,
      onClick: onLedger,
    });
  }
  if (capabilities.canDelete) {
    actions.push({
      key: "delete",
      label: t("chartOfAccounts.actions.delete", { namespace: "accounting" }),
      icon: Trash2,
      tone: "danger",
      disabled: false,
      onClick: onDelete,
    });
  }

  return actions;
}