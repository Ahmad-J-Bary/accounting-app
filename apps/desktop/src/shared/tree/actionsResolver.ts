import { Plus, Edit, BookOpen, Trash2 } from "lucide-react";
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

/** Arabic labels for the per-branch "new" button. */
export const CREATE_LABELS: Record<TreeNodeCreatePanelKind, string> = {
  account: "حساب جديد",
  customer: "إضافة عميل جديد",
  supplier: "مورد جديد",
  "expense-item": "إضافة بند مصروف",
  "fixed-asset": "أصل جديد",
  partner: "إضافة شريك جديد",
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

export interface AccountNodeActionContext {
  resolved: ResolvedTreeNode;
  onNew?: () => void;
  onEdit?: () => void;
  onLedger?: () => void;
  onDelete?: () => void;
}

export function resolveAccountNodeActions(
  ctx: AccountNodeActionContext,
): TreeNodeAction[] {
  const { resolved, onNew, onEdit, onLedger, onDelete } = ctx;
  const { capabilities, entityType } = resolved;
  const onlyRoot = entityType === "root";

  const actions: TreeNodeAction[] = [];

  if (capabilities.canCreate && !onlyRoot) {
    actions.push({
      key: "new",
      label: CREATE_LABELS[capabilities.createPanelKind ?? "account"],
      icon: Plus,
      tone: "primary",
      disabled: false,
      onClick: onNew,
    });
  }
  if (capabilities.canEdit) {
    actions.push({ key: "edit", label: "تعديل", icon: Edit, disabled: false, onClick: onEdit });
  }
  if (capabilities.canViewLedger) {
    actions.push({
      key: "ledger",
      label: "حركة اليومية",
      icon: BookOpen,
      disabled: false,
      onClick: onLedger,
    });
  }
  if (capabilities.canDelete) {
    actions.push({
      key: "delete",
      label: "حذف",
      icon: Trash2,
      tone: "danger",
      disabled: false,
      onClick: onDelete,
    });
  }

  return actions;
}