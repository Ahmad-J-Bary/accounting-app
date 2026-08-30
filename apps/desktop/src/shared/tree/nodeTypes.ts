import type { LucideIcon } from "lucide-react";

/**
 * Semantic classification of a tree node. Central vocabulary shared by the
 * Chart of Accounts (dليل الحسابات) and Categories (تصنيفات المواد) trees so
 * per-node behavior ("new", "edit", "delete", "ledger") is resolved in ONE
 * place instead of hand-written per page.
 */
export type TreeNodeEntityType =
  | "root"
  | "account-group"
  | "account"
  | "customer-account"
  | "supplier-account"
  | "expense-account"
  | "fixed-asset-account"
  | "partner-account";

/**
 * Operational branch an account node belongs to (derived from ancestor system
 * IDs / purposes). Selects which entity-specific "new" form to open.
 */
export type TreeNodeBranch =
  | "general"
  | "customers"
  | "suppliers"
  | "expenses"
  | "fixed-assets"
  | "partners";

/** Which panel/entity form a "جديد" action should open. */
export type TreeNodeCreatePanelKind =
  | "account"
  | "customer"
  | "supplier"
  | "expense-item"
  | "fixed-asset"
  | "partner";

/** What operations are allowed for a resolved node. */
export interface TreeNodeCapabilities {
  canCreate: boolean;
  createPanelKind: TreeNodeCreatePanelKind | null;
  canEdit: boolean;
  canDelete: boolean;
  canViewLedger: boolean;
}

/** Result of the central node resolver. */
export interface ResolvedTreeNode {
  entityType: TreeNodeEntityType;
  branch: TreeNodeBranch;
  capabilities: TreeNodeCapabilities;
  /** Linked partner id (customer/supplier) when entityType is *-account. */
  linkedEntityId?: string | null;
  /**
   * For partner accounts: which partner account slot matches this account
   * (capital ↔ linked_account_id, drawings ↔ drawings_account_id,
   * current ↔ current_account_id). Set only for entityType "partner-account".
   */
  linkedPartnerRole?: "capital" | "drawings" | "current" | null;
}

/** A toolbar action descriptor produced by the central action resolver. */
export interface TreeNodeAction {
  key: "new" | "edit" | "ledger" | "delete";
  label: string;
  disabled: boolean;
  icon?: LucideIcon;
  tone?: "primary" | "default" | "danger";
  onClick?: () => void;
}

/** Arabic display labels per entity type (detail badges, tooltips). */
export const ENTITY_LABELS: Record<TreeNodeEntityType, string> = {
  root: "الدليل الجذر",
  "account-group": "مجموعة حسابات",
  account: "حساب",
  "customer-account": "حساب عميل",
  "supplier-account": "حساب مورد",
  "expense-account": "بند مصروف",
  "fixed-asset-account": "حساب أصل ثابت",
  "partner-account": "حساب شريك",
};